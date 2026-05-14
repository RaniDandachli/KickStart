import type { QueueKind } from '@/store/matchmakingStore';
import { h2hGameKeyToMinigameType } from '@/lib/h2hSkillContestGames';
import type { H2hSkillContestGameKey } from '@/lib/h2hSkillContestGames';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';
import { getSupabase } from '@/supabase/client';

export type SubmitAsyncH2hHostSkillRunParams = {
  mode: QueueKind;
  gameKey: H2hSkillContestGameKey;
  /** Wallet cents — must match queue tier. */
  entryFeeWalletCents: number;
  listedPrizeUsdCents: number;
  score: number;
  durationMs: number;
  taps: number;
};

export async function submitAsyncH2hHostSkillRun(
  params: SubmitAsyncH2hHostSkillRunParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const hostGameType = h2hGameKeyToMinigameType(params.gameKey);
  const { error } = await invokeEdgeFunction('submitAsyncH2hHostRun', {
    body: {
      mode: params.mode,
      game_key: params.gameKey,
      entry_fee_wallet_cents: Math.max(0, Math.floor(params.entryFeeWalletCents)),
      listed_prize_usd_cents: Math.max(0, Math.floor(params.listedPrizeUsdCents)),
      host_score: Math.floor(params.score),
      host_game_type: hostGameType,
      duration_ms: Math.max(0, Math.floor(params.durationMs)),
      taps: Math.max(0, Math.floor(params.taps)),
    },
    timeout: 45_000,
  });
  if (error) return { ok: false, error: error.message ?? 'submit_failed' };
  return { ok: true };
}

/** @deprecated use submitAsyncH2hHostSkillRun */
export async function submitAsyncH2hHostTapDashRun(
  params: Omit<SubmitAsyncH2hHostSkillRunParams, 'gameKey'>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return submitAsyncH2hHostSkillRun({ ...params, gameKey: 'tap-dash' });
}

export async function cancelAsyncH2hHostRun(): Promise<{ ok: true; cancelled: boolean } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('h2h_async_host_cancel');
  if (error) return { ok: false, error: error.message };
  const j = data as Record<string, unknown>;
  if (j?.ok !== true) return { ok: false, error: String(j?.error ?? 'cancel_failed') };
  return { ok: true, cancelled: j.cancelled === true };
}
