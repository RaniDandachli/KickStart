-- Leave pre-game lobby: cancel session and refund both players' contest access (wallet) when entry > 0.

alter table public.transactions drop constraint if exists transactions_kind_check;

alter table public.transactions add constraint transactions_kind_check check (kind in (
  'credit_earn', 'credit_spend', 'gem_earn', 'gem_spend',
  'reward_grant', 'cosmetic_purchase', 'subscription_event', 'admin_adjustment',
  'prize_credit_earn', 'prize_credit_spend',
  'redeem_ticket_spend',
  'wallet_withdraw',
  'h2h_contest_entry',
  'h2h_contest_entry_refund'
));

comment on constraint transactions_kind_check on public.transactions is
  'h2h_contest_entry_refund: wallet credit when H2H lobby abandoned before play (mirrors h2h_contest_entry).';

create or replace function public.h2h_abandon_match_session(p_match_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_status text;
  v_entry bigint;
  v_pa uuid;
  v_pb uuid;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select ms.status, ms.entry_fee_wallet_cents, ms.player_a_id, ms.player_b_id
    into v_status, v_entry, v_pa, v_pb
  from public.match_sessions ms
  where ms.id = p_match_session_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_pa is null or v_pb is null then
    return jsonb_build_object('ok', false, 'error', 'players_not_set');
  end if;

  if v_me <> v_pa and v_me <> v_pb then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_status = 'completed' then
    return jsonb_build_object('ok', true, 'noop', true, 'reason', 'completed');
  end if;

  if v_status = 'cancelled' then
    return jsonb_build_object('ok', true, 'noop', true, 'reason', 'cancelled');
  end if;

  if v_status = 'in_progress' then
    return jsonb_build_object('ok', false, 'error', 'cannot_abandon_after_start');
  end if;

  if v_status <> 'lobby' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', v_status);
  end if;

  v_entry := greatest(coalesce(v_entry, 0), 0);

  update public.match_sessions
  set
    status = 'cancelled',
    ended_at = coalesce(ended_at, now()),
    updated_at = now()
  where id = p_match_session_id;

  if v_entry > 0 then
    update public.profiles
    set wallet_cents = wallet_cents + v_entry, updated_at = now()
    where id = v_pa;

    update public.profiles
    set wallet_cents = wallet_cents + v_entry, updated_at = now()
    where id = v_pb;

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      v_pa,
      'h2h_contest_entry_refund',
      v_entry,
      'wallet_cents',
      'Skill contest — match access refunded (lobby left)',
      jsonb_build_object('match_session_id', p_match_session_id, 'side', 'player_a')
    );

    insert into public.transactions (user_id, kind, amount, currency, description, metadata)
    values (
      v_pb,
      'h2h_contest_entry_refund',
      v_entry,
      'wallet_cents',
      'Skill contest — match access refunded (lobby left)',
      jsonb_build_object('match_session_id', p_match_session_id, 'side', 'player_b')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'refunded_wallet_cents_each', case when v_entry > 0 then v_entry else 0 end
  );
end;
$$;

revoke all on function public.h2h_abandon_match_session(uuid) from public;
grant execute on function public.h2h_abandon_match_session(uuid) to authenticated;

comment on function public.h2h_abandon_match_session(uuid) is
  'Participant cancels H2H while still in lobby; refunds both entry debits when entry_fee_wallet_cents > 0.';
