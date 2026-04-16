import { H2H_QUICK_MATCH_GAME_KEY } from '@/lib/homeOpenMatches';
import { normalizeQuickMatchAllowedEntries } from '@/lib/quickMatchTiers';
import type { QuickMatchCtx } from '@/features/play/matchmakingTypes';
import type { QueueKind } from '@/store/matchmakingStore';

/** Same tier resolution as queue `start()` — shared by `QueueScreen` + global poll host. */
export function buildBackendQueueParams(args: {
  mode: QueueKind;
  quickCtx: QuickMatchCtx | null;
  entryFeeUsd?: number;
  listedPrizeUsd?: number;
  gameKey?: string;
  queueTierCents?: { entry: number; prize: number };
}): {
  mode: QueueKind;
  gameKey: string;
  entryFeeWalletCents: number;
  listedPrizeUsdCents: number;
  maxAffordableEntryCents?: number;
  quickMatchAllowedEntryCents?: number[];
} {
  const q = args.quickCtx;
  if (q?.isQuickMatchWildcard) {
    const cap = Math.max(0, Math.floor(q.maxAffordableEntryCents ?? 0));
    const allowed = normalizeQuickMatchAllowedEntries(q.allowedEntryCents ?? [0], cap);
    return {
      mode: args.mode,
      gameKey: H2H_QUICK_MATCH_GAME_KEY,
      entryFeeWalletCents: 0,
      listedPrizeUsdCents: 0,
      maxAffordableEntryCents: cap,
      quickMatchAllowedEntryCents: allowed.length > 0 ? allowed : [0],
    };
  }
  const isFreeCasual = q?.isFreeCasual === true;
  const effectiveEntry = isFreeCasual ? undefined : q != null ? q.entryUsd : args.entryFeeUsd;
  const effectivePrize = isFreeCasual ? undefined : q != null ? q.prizeUsd : args.listedPrizeUsd;
  const hasPaidEntry =
    !isFreeCasual &&
    effectiveEntry != null &&
    effectivePrize != null &&
    !Number.isNaN(effectiveEntry) &&
    !Number.isNaN(effectivePrize);
  const resolvedGameKey = (q?.gameKey ?? args.gameKey) ?? '';
  return {
    mode: args.mode,
    gameKey: resolvedGameKey,
    entryFeeWalletCents:
      hasPaidEntry && effectiveEntry != null
        ? (q?.exactTierCents?.entry ?? args.queueTierCents?.entry ?? Math.round(effectiveEntry * 100))
        : 0,
    listedPrizeUsdCents:
      hasPaidEntry && effectivePrize != null
        ? (q?.exactTierCents?.prize ?? args.queueTierCents?.prize ?? Math.round(effectivePrize * 100))
        : 0,
  };
}
