-- Head-to-head contest settlement: winner → cash wallet (listed prize); loser → Arcade Credits (prize_credits).
-- Idempotent per match_session_id. Runs in DB (SECURITY DEFINER) so awards cannot be forged from the client.
-- Logical balances: profiles.wallet_cents = cash; profiles.prize_credits = arcade-only credits; profiles.redeem_tickets = tickets.

-- ---------------------------------------------------------------------------
-- Lookup: consolation credits by entry fee (cents). Keep in sync with constants/h2hLossArcadeCredits.ts
-- ---------------------------------------------------------------------------

create or replace function public.h2h_loss_arcade_credits_for_entry_fee(p_entry_fee_wallet_cents bigint)
returns bigint
language sql
immutable
set search_path = public
as $$
  select case p_entry_fee_wallet_cents
    when 100 then 60::bigint
    when 500 then 250::bigint
    when 1000 then 500::bigint
    when 2000 then 1000::bigint
    when 5000 then 2500::bigint
    when 10000 then 5000::bigint
    else 0::bigint
  end;
$$;

comment on function public.h2h_loss_arcade_credits_for_entry_fee(bigint) is
  'Arcade Credits granted to H2H loser by tiered entry fee (wallet cents). Mirror constants/h2hLossArcadeCredits.ts.';

-- ---------------------------------------------------------------------------
-- Settlement ledger (idempotency)
-- ---------------------------------------------------------------------------

create table if not exists public.h2h_contest_economy_settlements (
  match_session_id uuid primary key references public.match_sessions (id) on delete cascade,
  match_result_id uuid not null references public.match_results (id) on delete cascade,
  winner_user_id uuid not null references public.profiles (id) on delete cascade,
  loser_user_id uuid not null references public.profiles (id) on delete cascade,
  entry_fee_wallet_cents bigint not null default 0,
  prize_wallet_cents_granted bigint not null default 0 check (prize_wallet_cents_granted >= 0),
  consolation_prize_credits_granted bigint not null default 0 check (consolation_prize_credits_granted >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_h2h_settlements_result on public.h2h_contest_economy_settlements (match_result_id);

alter table public.h2h_contest_economy_settlements enable row level security;

create policy "h2h_settlements_no_select"
  on public.h2h_contest_economy_settlements for select to authenticated using (false);

create policy "h2h_settlements_no_write"
  on public.h2h_contest_economy_settlements for all to authenticated using (false) with check (false);

comment on table public.h2h_contest_economy_settlements is
  'One row per settled H2H match_session: cash prize to winner, arcade credits to loser; service role reads for Edge responses.';

-- ---------------------------------------------------------------------------
-- Trigger: after match_results insert (H2H session with winner + loser)
-- ---------------------------------------------------------------------------

create or replace function public.apply_h2h_contest_economy_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry bigint;
  v_prize bigint;
  v_consolation bigint;
begin
  if new.match_session_id is null
     or new.winner_user_id is null
     or new.loser_user_id is null then
    return new;
  end if;

  select
    coalesce(s.entry_fee_wallet_cents, 0),
    coalesce(s.listed_prize_usd_cents, 0)
  into v_entry, v_prize
  from public.match_sessions s
  where s.id = new.match_session_id;

  v_consolation := public.h2h_loss_arcade_credits_for_entry_fee(v_entry);

  -- Claim settlement row first; skip payouts if another row already settled this session.
  begin
    insert into public.h2h_contest_economy_settlements (
      match_session_id,
      match_result_id,
      winner_user_id,
      loser_user_id,
      entry_fee_wallet_cents,
      prize_wallet_cents_granted,
      consolation_prize_credits_granted
    )
    values (
      new.match_session_id,
      new.id,
      new.winner_user_id,
      new.loser_user_id,
      v_entry,
      case when v_prize > 0 then v_prize else 0 end,
      case when v_consolation > 0 then v_consolation else 0 end
    );
  exception
    when unique_violation then
      return new;
  end;

  if v_prize > 0 then
    update public.profiles
    set
      wallet_cents = wallet_cents + v_prize,
      updated_at = now()
    where id = new.winner_user_id;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      new.winner_user_id,
      'reward_grant',
      v_prize,
      'wallet_cents',
      'Skill contest — top performer prize',
      jsonb_build_object(
        'source', 'h2h_contest_win',
        'match_session_id', new.match_session_id,
        'match_result_id', new.id
      )
    );
  end if;

  if v_consolation > 0 then
    update public.profiles
    set
      prize_credits = prize_credits + v_consolation,
      updated_at = now()
    where id = new.loser_user_id;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      new.loser_user_id,
      'prize_credit_earn',
      v_consolation,
      'prize_credits',
      'Arcade Credits — match participation (gameplay only, not cash)',
      jsonb_build_object(
        'source', 'h2h_loss_consolation',
        'match_session_id', new.match_session_id,
        'match_result_id', new.id,
        'arcade_only', true,
        'non_withdrawable', true,
        'non_transferable', true
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_match_results_h2h_economy on public.match_results;
create trigger trg_match_results_h2h_economy
  after insert on public.match_results
  for each row
  execute function public.apply_h2h_contest_economy_settlement();

comment on function public.apply_h2h_contest_economy_settlement() is
  'Credits winner wallet (listed prize USD cents) and loser prize_credits (tiered consolation) once per H2H match_session.';
