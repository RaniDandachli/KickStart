import { getSupabase } from '@/supabase/client';
import type { QueueKind } from '@/store/matchmakingStore';

export type H2hEnqueueOrMatchResult =
  | { ok: true; matched: true; match_session_id: string; opponent_user_id: string }
  | { ok: true; matched: false; queue_entry_id: string }
  | { ok: false; error: string; detail?: string };

export async function h2hEnqueueOrMatch(params: {
  mode: QueueKind;
  gameKey: string;
  entryFeeWalletCents: number;
  listedPrizeUsdCents: number;
}): Promise<H2hEnqueueOrMatchResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('h2h_enqueue_or_match', {
    p_mode: params.mode,
    p_game_key: params.gameKey,
    p_entry_fee_wallet_cents: params.entryFeeWalletCents,
    p_listed_prize_usd_cents: params.listedPrizeUsdCents,
  });
  if (error) throw new Error(error.message);
  const j = data as Record<string, unknown>;
  if (j?.ok !== true) {
    return {
      ok: false,
      error: String(j?.error ?? 'queue_error'),
      detail: typeof j?.detail === 'string' ? j.detail : undefined,
    };
  }
  const matchedRaw = j.matched;
  const isMatched =
    matchedRaw === true || matchedRaw === 'true' || matchedRaw === 1 || matchedRaw === '1';
  if (isMatched) {
    return {
      ok: true,
      matched: true,
      match_session_id: String(j.match_session_id),
      opponent_user_id: String(j.opponent_user_id),
    };
  }
  return { ok: true, matched: false, queue_entry_id: String(j.queue_entry_id) };
}

/** Quick Match: pair with any affordable specific waiter, or wait as wildcard (`__quick_match__`). */
export async function h2hEnqueueQuickMatch(params: {
  mode: QueueKind;
  maxAffordableEntryCents: number;
}): Promise<H2hEnqueueOrMatchResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('h2h_enqueue_quick_match', {
    p_mode: params.mode,
    p_max_affordable_entry_cents: Math.max(0, Math.floor(params.maxAffordableEntryCents)),
  });
  if (error) throw new Error(error.message);
  const j = data as Record<string, unknown>;
  if (j?.ok !== true) {
    return {
      ok: false,
      error: String(j?.error ?? 'queue_error'),
      detail: typeof j?.detail === 'string' ? j.detail : undefined,
    };
  }
  const matchedRawQm = j.matched;
  const isMatchedQm =
    matchedRawQm === true ||
    matchedRawQm === 'true' ||
    matchedRawQm === 1 ||
    matchedRawQm === '1';
  if (isMatchedQm) {
    return {
      ok: true,
      matched: true,
      match_session_id: String(j.match_session_id),
      opponent_user_id: String(j.opponent_user_id),
    };
  }
  return { ok: true, matched: false, queue_entry_id: String(j.queue_entry_id) };
}

export async function h2hCancelQueue(): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('h2h_cancel_queue');
  if (error) throw new Error(error.message);
  const j = data as { ok?: boolean };
  if (j?.ok !== true) throw new Error('Could not leave queue');
}
