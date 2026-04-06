import { getSupabase } from '@/supabase/client';

export type H2hTapDashScoresPayload = {
  ok: true;
  player_a_score: number | null;
  player_b_score: number | null;
  self_score: number | null;
  opponent_score: number | null;
  both_submitted: boolean;
};

export async function fetchH2hTapDashScoresForMatch(matchSessionId: string): Promise<H2hTapDashScoresPayload | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('h2h_tap_dash_scores_for_match', {
    p_match_session_id: matchSessionId,
  });
  if (error) throw error;
  const j = data as Record<string, unknown>;
  if (j?.ok !== true) return null;
  return {
    ok: true,
    player_a_score: j.player_a_score == null ? null : Number(j.player_a_score),
    player_b_score: j.player_b_score == null ? null : Number(j.player_b_score),
    self_score: j.self_score == null ? null : Number(j.self_score),
    opponent_score: j.opponent_score == null ? null : Number(j.opponent_score),
    both_submitted: j.both_submitted === true,
  };
}

export async function fileH2hMatchDisputeRpc(matchSessionId: string, details: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('h2h_file_match_dispute', {
    p_match_session_id: matchSessionId,
    p_details: details,
  });
  if (error) throw new Error(error.message);
  const j = data as Record<string, unknown>;
  if (j?.ok !== true) {
    return { ok: false, error: String(j?.error ?? 'dispute_failed') };
  }
  return { ok: true };
}
