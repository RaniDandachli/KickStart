import { getSupabase } from '@/supabase/client';

export type H2hTapDashScoresPayload = {
  ok: true;
  player_a_score: number | null;
  player_b_score: number | null;
  self_score: number | null;
  opponent_score: number | null;
  both_submitted: boolean;
};

function gameTypeFromMatchGameKey(gameKey: string | null | undefined): string | null {
  const gk = String(gameKey ?? '').trim().toLowerCase();
  if (gk === '' || gk === 'tap-dash') return 'tap_dash';
  if (gk === 'tile-clash') return 'tile_clash';
  if (gk === 'ball-run') return 'ball_run';
  if (gk === 'dash-duel') return 'dash_duel';
  if (gk === 'turbo-arena') return 'turbo_arena';
  if (gk === 'neon-dance') return 'neon_dance';
  if (gk === 'neon-grid') return 'neon_grid';
  if (gk === 'neon-ship') return 'neon_ship';
  if (gk === 'shape-dash') return 'shape_dash';
  if (gk === 'cyber-road') return 'cyber_road';
  return null;
}

async function fetchH2hScoresFallback(matchSessionId: string): Promise<H2hTapDashScoresPayload | null> {
  const supabase = getSupabase();
  const [{ data: authData }, { data: sessionRow, error: sessionErr }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('match_sessions')
      .select('player_a_id,player_b_id,game_key')
      .eq('id', matchSessionId)
      .single(),
  ]);
  if (sessionErr || !sessionRow) return null;
  const me = authData.user?.id;
  if (!me) return null;
  const playerA = String(sessionRow.player_a_id ?? '');
  const playerB = String(sessionRow.player_b_id ?? '');
  if (!playerA || !playerB) return null;
  if (me !== playerA && me !== playerB) return null;
  const gameType = gameTypeFromMatchGameKey((sessionRow as { game_key?: string | null }).game_key);
  if (!gameType) return null;

  const { data: scoreRows, error: scoreErr } = await supabase
    .from('minigame_scores')
    .select('user_id,score,created_at')
    .eq('match_session_id', matchSessionId)
    .eq('game_type', gameType)
    .in('user_id', [playerA, playerB])
    .order('created_at', { ascending: false });
  if (scoreErr) return null;

  let playerAScore: number | null = null;
  let playerBScore: number | null = null;
  for (const row of scoreRows ?? []) {
    const uid = String((row as { user_id?: string }).user_id ?? '');
    const score = Number((row as { score?: number }).score ?? 0);
    if (uid === playerA && playerAScore == null) playerAScore = score;
    if (uid === playerB && playerBScore == null) playerBScore = score;
    if (playerAScore != null && playerBScore != null) break;
  }

  const selfScore = me === playerA ? playerAScore : playerBScore;
  const opponentScore = me === playerA ? playerBScore : playerAScore;
  return {
    ok: true,
    player_a_score: playerAScore,
    player_b_score: playerBScore,
    self_score: selfScore,
    opponent_score: opponentScore,
    both_submitted: playerAScore != null && playerBScore != null,
  };
}

export async function fetchH2hTapDashScoresForMatch(matchSessionId: string): Promise<H2hTapDashScoresPayload | null> {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase.rpc('h2h_tap_dash_scores_for_match', {
      p_match_session_id: matchSessionId,
    });
    if (!error) {
      const j = data as Record<string, unknown>;
      if (j?.ok === true) {
        return {
          ok: true,
          player_a_score: j.player_a_score == null ? null : Number(j.player_a_score),
          player_b_score: j.player_b_score == null ? null : Number(j.player_b_score),
          self_score: j.self_score == null ? null : Number(j.self_score),
          opponent_score: j.opponent_score == null ? null : Number(j.opponent_score),
          both_submitted: j.both_submitted === true,
        };
      }
    }
  } catch {
    // Fallback below handles stale/missing RPCs.
  }
  return fetchH2hScoresFallback(matchSessionId);
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
