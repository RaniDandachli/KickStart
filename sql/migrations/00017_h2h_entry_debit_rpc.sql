-- H2H paid contests: debit both players' cash wallets when a match session is created (entry → operator).
-- Listed prizes are credited separately on match result (operator-funded top-performer prize — not a player pool).
-- RPC is service-role only (invoked from createH2hMatchSession Edge Function).

alter table public.transactions drop constraint if exists transactions_kind_check;

alter table public.transactions add constraint transactions_kind_check check (kind in (
  'credit_earn', 'credit_spend', 'gem_earn', 'gem_spend',
  'reward_grant', 'cosmetic_purchase', 'subscription_event', 'admin_adjustment',
  'prize_credit_earn', 'prize_credit_spend',
  'redeem_ticket_spend',
  'wallet_withdraw',
  'h2h_contest_entry'
));

comment on constraint transactions_kind_check on public.transactions is
  'h2h_contest_entry: cash wallet debit for skill-contest match access (Run It); wallet_withdraw: Stripe Connect cash-out.';

-- ---------------------------------------------------------------------------
-- Atomic: create session + optional dual entry debits + ledger rows
-- ---------------------------------------------------------------------------

create or replace function public.h2h_create_match_session_and_debit_entries(
  p_initiator uuid,
  p_opponent uuid,
  p_mode text,
  p_game_key text,
  p_entry_fee_wallet_cents bigint,
  p_listed_prize_usd_cents bigint
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_a bigint;
  v_b bigint;
  v_entry bigint;
  v_game text;
begin
  if p_initiator is null or p_opponent is null or p_initiator = p_opponent then
    raise exception 'invalid_players';
  end if;

  if p_mode is null or p_mode not in ('casual', 'ranked', 'custom') then
    raise exception 'invalid_mode';
  end if;

  v_entry := greatest(coalesce(p_entry_fee_wallet_cents, 0), 0);

  v_game := nullif(trim(coalesce(p_game_key, '')), '');

  if v_entry > 0 then
    select wallet_cents into v_a from public.profiles where id = p_initiator for update;
    select wallet_cents into v_b from public.profiles where id = p_opponent for update;
    if v_a is null or v_b is null then
      raise exception 'profile_not_found';
    end if;
    if v_a < v_entry or v_b < v_entry then
      raise exception 'insufficient_wallet';
    end if;
  end if;

  insert into public.match_sessions (
    mode,
    status,
    player_a_id,
    player_b_id,
    game_key,
    entry_fee_wallet_cents,
    listed_prize_usd_cents,
    started_at
  )
  values (
    p_mode,
    'lobby',
    p_initiator,
    p_opponent,
    v_game,
    v_entry,
    case when coalesce(p_listed_prize_usd_cents, 0) > 0 then p_listed_prize_usd_cents else null end,
    now()
  )
  returning id into v_id;

  if v_entry > 0 then
    update public.profiles
    set wallet_cents = wallet_cents - v_entry, updated_at = now()
    where id = p_initiator;

    update public.profiles
    set wallet_cents = wallet_cents - v_entry, updated_at = now()
    where id = p_opponent;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      p_initiator,
      'h2h_contest_entry',
      v_entry,
      'wallet_cents',
      'Skill contest — match access (Run It)',
      jsonb_build_object('match_session_id', v_id, 'side', 'initiator')
    );

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      p_opponent,
      'h2h_contest_entry',
      v_entry,
      'wallet_cents',
      'Skill contest — match access (Run It)',
      jsonb_build_object('match_session_id', v_id, 'side', 'opponent')
    );
  end if;

  return v_id;
end;
$$;

comment on function public.h2h_create_match_session_and_debit_entries(uuid, uuid, text, text, bigint, bigint) is
  'Creates match_sessions; if entry fee > 0, debits both players and writes h2h_contest_entry ledger rows. Edge/service_role only.';

revoke all on function public.h2h_create_match_session_and_debit_entries(uuid, uuid, text, text, bigint, bigint) from public;
revoke all on function public.h2h_create_match_session_and_debit_entries(uuid, uuid, text, text, bigint, bigint) from authenticated;
grant execute on function public.h2h_create_match_session_and_debit_entries(uuid, uuid, text, text, bigint, bigint) to service_role;
grant execute on function public.h2h_create_match_session_and_debit_entries(uuid, uuid, text, text, bigint, bigint) to postgres;
