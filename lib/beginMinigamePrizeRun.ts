import { getSupabase } from '@/supabase/client';

export const PRIZE_RUN_GAME_TYPES = [
  'tap_dash',
  'tile_clash',
  'ball_run',
  'neon_pool',
  'stacker',
  'dash_duel',
  'turbo_arena',
  'neon_dance',
] as const;

export type PrizeRunGameType = (typeof PRIZE_RUN_GAME_TYPES)[number];

export type BeginMinigamePrizeRunOk = {
  ok: true;
  reservationId: string;
  prizeCredits: number;
};

export type BeginMinigamePrizeRunErr = {
  ok: false;
  error: 'insufficient_credits' | 'invalid_game' | 'not_authenticated' | 'rpc_error';
  message?: string;
};

export async function beginMinigamePrizeRun(
  gameType: PrizeRunGameType,
): Promise<BeginMinigamePrizeRunOk | BeginMinigamePrizeRunErr> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('begin_minigame_prize_run', { p_game_type: gameType });
  if (error) {
    return { ok: false, error: 'rpc_error', message: error.message };
  }
  const row = data as {
    ok?: boolean;
    error?: string;
    reservation_id?: string;
    prize_credits?: number;
  };
  if (!row?.ok) {
    const e = row?.error ?? '';
    if (e === 'insufficient_credits') return { ok: false, error: 'insufficient_credits' };
    if (e === 'invalid_game_type') return { ok: false, error: 'invalid_game' };
    if (e === 'not_authenticated') return { ok: false, error: 'not_authenticated' };
    return { ok: false, error: 'rpc_error', message: e };
  }
  if (typeof row.reservation_id !== 'string') {
    return { ok: false, error: 'rpc_error', message: 'missing reservation_id' };
  }
  return {
    ok: true,
    reservationId: row.reservation_id,
    prizeCredits: typeof row.prize_credits === 'number' ? row.prize_credits : 0,
  };
}
