-- Atomic tournament join (wallet debit + entry row + count/state) and admin prize grants.

alter table public.transactions drop constraint if exists transactions_kind_check;

alter table public.transactions add constraint transactions_kind_check check (kind in (
  'credit_earn', 'credit_spend', 'gem_earn', 'gem_spend',
  'reward_grant', 'cosmetic_purchase', 'subscription_event', 'admin_adjustment',
  'prize_credit_earn', 'prize_credit_spend',
  'redeem_ticket_spend',
  'wallet_withdraw',
  'h2h_contest_entry',
  'h2h_contest_entry_refund',
  'tournament_entry',
  'tournament_prize_grant'
));

comment on constraint transactions_kind_check on public.transactions is
  'tournament_entry: cash wallet debit for tournament registration; tournament_prize_grant: admin prize to wallet.';

-- ---------------------------------------------------------------------------
-- join_tournament: single transaction — fee debit, ledger row, entry, count/state
-- ---------------------------------------------------------------------------
create or replace function public.join_tournament(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_t public.tournaments%rowtype;
  v_fee bigint := 0;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'tournament_not_found');
  end if;

  if v_t.state <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'tournament_not_joinable');
  end if;

  if v_t.current_player_count >= v_t.max_players then
    return jsonb_build_object('ok', false, 'error', 'tournament_full');
  end if;

  if exists (
    select 1 from public.tournament_entries te
    where te.tournament_id = p_tournament_id and te.user_id = v_me
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_entered');
  end if;

  if v_t.entry_type = 'credits' and coalesce(v_t.entry_fee_wallet_cents, 0) > 0 then
    v_fee := v_t.entry_fee_wallet_cents;
  end if;

  if v_fee > 0 then
    update public.profiles
    set wallet_cents = wallet_cents - v_fee, updated_at = now()
    where id = v_me and wallet_cents >= v_fee;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'insufficient_wallet');
    end if;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      v_me,
      'tournament_entry',
      v_fee,
      'wallet_cents',
      'Tournament entry fee',
      jsonb_build_object('tournament_id', p_tournament_id)
    );
  end if;

  insert into public.tournament_entries (tournament_id, user_id, status)
  values (p_tournament_id, v_me, 'registered');

  update public.tournaments
  set
    current_player_count = current_player_count + 1,
    state = case
      when current_player_count + 1 >= max_players then 'full'
      else state
    end,
    updated_at = now()
  where id = p_tournament_id;

  return jsonb_build_object(
    'ok', true,
    'current_player_count', (select current_player_count from public.tournaments where id = p_tournament_id),
    'state', (select state from public.tournaments where id = p_tournament_id)
  );
end;
$$;

comment on function public.join_tournament(uuid) is
  'Authenticated user joins a tournament: optional wallet fee, entry row, increments count and may set state to full.';

grant execute on function public.join_tournament(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin prize grant (transactional profile + ledger); caller must be admin.
-- ---------------------------------------------------------------------------
create or replace function public.admin_award_tournament_prize(
  p_tournament_id uuid,
  p_target_user_id uuid,
  p_wallet_cents bigint,
  p_prize_credits bigint,
  p_gems bigint,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_w bigint := greatest(coalesce(p_wallet_cents, 0), 0);
  v_pc bigint := greatest(coalesce(p_prize_credits, 0), 0);
  v_g bigint := greatest(coalesce(p_gems, 0), 0);
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_w = 0 and v_pc = 0 and v_g = 0 then
    return jsonb_build_object('ok', false, 'error', 'nothing_to_grant');
  end if;

  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  update public.profiles
  set
    wallet_cents = wallet_cents + v_w,
    prize_credits = prize_credits + v_pc,
    gems = gems + v_g,
    updated_at = now()
  where id = p_target_user_id;

  if v_w > 0 then
    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      p_target_user_id,
      'tournament_prize_grant',
      v_w,
      'wallet_cents',
      coalesce(nullif(trim(p_description), ''), 'Tournament prize'),
      jsonb_build_object('tournament_id', p_tournament_id, 'granted_by', v_actor)
    );
  end if;

  if v_pc > 0 then
    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      p_target_user_id,
      'prize_credit_earn',
      v_pc,
      'prize_credits',
      coalesce(nullif(trim(p_description), ''), 'Tournament prize (Arcade Credits)'),
      jsonb_build_object('tournament_id', p_tournament_id, 'granted_by', v_actor)
    );
  end if;

  if v_g > 0 then
    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      p_target_user_id,
      'gem_earn',
      v_g,
      'gems',
      coalesce(nullif(trim(p_description), ''), 'Tournament prize (gems)'),
      jsonb_build_object('tournament_id', p_tournament_id, 'granted_by', v_actor)
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.admin_award_tournament_prize(uuid, uuid, bigint, bigint, bigint, text) is
  'Admin-only: credits target user wallet / prize_credits / gems and writes ledger rows.';

grant execute on function public.admin_award_tournament_prize(uuid, uuid, bigint, bigint, bigint, text) to authenticated;

-- Inserts must go through join_tournament (atomic fee + entry).
drop policy if exists tournament_entries_insert_own on public.tournament_entries;
revoke insert on public.tournament_entries from authenticated;
