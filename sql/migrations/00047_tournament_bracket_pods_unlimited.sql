-- Mirror of supabase/migrations/00047_tournament_bracket_pods_unlimited.sql

alter table public.tournaments
  add column if not exists unlimited_entrants boolean not null default false;

alter table public.tournaments
  add column if not exists bracket_pod_size int null
    check (bracket_pod_size is null or bracket_pod_size >= 2);

alter table public.tournament_entries
  add column if not exists bracket_pod_index int null;

alter table public.tournament_rounds drop constraint if exists tournament_rounds_tournament_id_round_index_key;

alter table public.tournament_rounds
  add column if not exists bracket_pod_index int not null default 1;

update public.tournament_rounds set bracket_pod_index = 1 where bracket_pod_index is null;

alter table public.tournament_rounds
  add constraint tournament_rounds_tournament_pod_round_unique unique (tournament_id, bracket_pod_index, round_index);

alter table public.tournament_matches
  add column if not exists bracket_pod_index int not null default 1;

update public.tournament_matches tm
set bracket_pod_index = tr.bracket_pod_index
from public.tournament_rounds tr
where tm.round_id = tr.id;

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

  if not coalesce(v_t.unlimited_entrants, false) then
    if v_t.current_player_count >= v_t.max_players then
      return jsonb_build_object('ok', false, 'error', 'tournament_full');
    end if;
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
      when coalesce(v_t.unlimited_entrants, false) then v_t.state
      when current_player_count + 1 >= max_players then 'full'
      else v_t.state
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
