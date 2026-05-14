import { getSupabase } from '@/supabase/client';
import type { H2hAsyncHostPendingRow, MatchSessionRow } from '@/types/database';

export type AsyncHostPendingWithMatch = {
  pending: H2hAsyncHostPendingRow;
  match: Pick<
    MatchSessionRow,
    'id' | 'status' | 'winner_user_id' | 'player_a_id' | 'player_b_id' | 'score_a' | 'score_b'
  > | null;
};

/**
 * Host's async contest rows (waiting for an opponent, or tied to a match after pickup).
 */
export async function fetchMyAsyncHostPendingWithMatches(
  userId: string,
  limit = 12,
): Promise<AsyncHostPendingWithMatch[]> {
  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from('h2h_async_host_pending')
    .select('*')
    .eq('host_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const pending = (rows ?? []) as H2hAsyncHostPendingRow[];
  const matchIds = pending.map((r) => r.consumed_match_session_id).filter((id): id is string => Boolean(id));
  if (matchIds.length === 0) {
    return pending.map((p) => ({ pending: p, match: null }));
  }

  const { data: matches, error: mErr } = await supabase
    .from('match_sessions')
    .select('id, status, winner_user_id, player_a_id, player_b_id, score_a, score_b')
    .in('id', matchIds);
  if (mErr) throw mErr;
  const byId = new Map((matches ?? []).map((m) => [m.id, m as AsyncHostPendingWithMatch['match']]));

  return pending.map((p) => ({
    pending: p,
    match: p.consumed_match_session_id ? byId.get(p.consumed_match_session_id) ?? null : null,
  }));
}
