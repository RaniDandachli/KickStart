import type { TournamentRoundRow, TournamentRow, TournamentRuleRow } from '@/types/database';
import { getSupabase } from '@/supabase/client';

export async function fetchTournaments(openOnly = false): Promise<TournamentRow[]> {
  const supabase = getSupabase();
  let q = supabase.from('tournaments').select('*').order('starts_at', { ascending: true });
  if (openOnly) q = q.in('state', ['open', 'full']);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TournamentRow[];
}

export async function fetchTournamentById(id: string): Promise<TournamentRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as TournamentRow | null;
}

export async function fetchTournamentRules(tournamentId: string): Promise<TournamentRuleRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tournament_rules')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TournamentRuleRow[];
}

export type JoinTournamentResult = {
  ok: boolean;
  error?: string;
  current_player_count?: number;
  state?: string;
};

/**
 * Atomic join: wallet fee (if any), ledger row, entry, count + open→full — via `join_tournament` RPC.
 */
export async function joinTournament(tournamentId: string): Promise<JoinTournamentResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('join_tournament', { p_tournament_id: tournamentId });
  if (error) {
    return { ok: false, error: error.message };
  }
  const row = data as { ok?: boolean; error?: string; current_player_count?: number; state?: string };
  if (row?.ok === false) {
    return { ok: false, error: row.error ?? 'Could not join tournament' };
  }
  return {
    ok: true,
    current_player_count: row.current_player_count,
    state: row.state,
  };
}

export type TournamentBracketMatch = {
  id: string;
  tournament_id: string;
  bracket_pod_index: number;
  round_id: string;
  match_index: number;
  player_a_id: string | null;
  player_b_id: string | null;
  winner_id: string | null;
  status: string;
  round_index: number;
  round_label: string;
};

export type TournamentBracketPod = {
  bracketPodIndex: number;
  rounds: TournamentRoundRow[];
  matches: TournamentBracketMatch[];
};

/**
 * Loads rounds + matches for bracket UI (single-elimination data from `generateBracket`).
 * Multiple `bracket_pod_index` values = parallel bracket waves (Friday cup unlimited signups).
 */
export async function fetchTournamentBracket(tournamentId: string): Promise<{
  rounds: TournamentRoundRow[];
  matches: TournamentBracketMatch[];
  pods: TournamentBracketPod[];
}> {
  const supabase = getSupabase();
  const [{ data: rounds, error: e1 }, { data: rawMatches, error: e2 }] = await Promise.all([
    supabase.from('tournament_rounds').select('*').eq('tournament_id', tournamentId).order('round_index', { ascending: true }),
    supabase
      .from('tournament_matches')
      .select(
        'id, tournament_id, bracket_pod_index, round_id, match_index, player_a_id, player_b_id, winner_id, status',
      )
      .eq('tournament_id', tournamentId)
      .order('match_index', { ascending: true }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const rlist = (rounds ?? []) as TournamentRoundRow[];
  const roundMeta = new Map(rlist.map((r) => [r.id, r]));
  const matches: TournamentBracketMatch[] = (rawMatches ?? []).map((m) => {
    const tr = roundMeta.get(m.round_id as string);
    return {
      id: m.id as string,
      tournament_id: m.tournament_id as string,
      bracket_pod_index: (m.bracket_pod_index as number) ?? 1,
      round_id: m.round_id as string,
      match_index: m.match_index as number,
      player_a_id: m.player_a_id as string | null,
      player_b_id: m.player_b_id as string | null,
      winner_id: m.winner_id as string | null,
      status: m.status as string,
      round_index: tr?.round_index ?? 0,
      round_label: tr?.label ?? '',
    };
  });
  matches.sort(
    (a, b) =>
      a.bracket_pod_index - b.bracket_pod_index || a.round_index - b.round_index || a.match_index - b.match_index,
  );

  const podIndexes = [...new Set(matches.map((m) => m.bracket_pod_index))].sort((x, y) => x - y);
  const pods: TournamentBracketPod[] = podIndexes.map((bracketPodIndex) => {
    const ms = matches.filter((m) => m.bracket_pod_index === bracketPodIndex);
    const roundIds = new Set(ms.map((m) => m.round_id));
    const rs = rlist.filter((r) => r.bracket_pod_index === bracketPodIndex && roundIds.has(r.id));
    return { bracketPodIndex, rounds: rs, matches: ms };
  });

  return { rounds: rlist, matches, pods };
}

/** Display names for bracket lines (batch). */
export async function fetchProfileDisplayByIds(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, string>();
  if (uniq.length === 0) return out;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', uniq);
  if (error) throw error;
  for (const p of data ?? []) {
    const row = p as { id: string; username: string; display_name: string | null };
    const label = (row.display_name && row.display_name.trim()) || row.username || row.id.slice(0, 8);
    out.set(row.id, label);
  }
  return out;
}
