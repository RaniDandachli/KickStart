import type { QuickMatchCtx } from '@/features/play/matchmakingTypes';
import { buildBackendQueueParams } from '@/lib/h2hBuildQueueParams';
import { H2H_QUICK_MATCH_GAME_KEY } from '@/lib/homeOpenMatches';
import type { QueueKind } from '@/store/matchmakingStore';

/** Mirrors `profiles.h2h_open_slot_watch` — see `h2hOpenMatchWatchScan` Edge function. */
export type H2hOpenSlotWatchPayload = {
  enabled: boolean;
  entryCents: number[];
  gameKeys: string[] | null;
};

type QueueArgs = {
  mode: QueueKind;
  quickCtx: QuickMatchCtx | null;
  entryFeeUsd?: number;
  listedPrizeUsd?: number;
  gameKey?: string;
  queueTierCents?: { entry: number; prize: number };
};

/**
 * Builds watch JSON for “someone is waiting in queue” pushes from the same inputs as `buildBackendQueueParams`.
 * - Quick Match wildcard: any game (`gameKeys: null`), tiers from selected entry amounts.
 * - Specific contest: that game key (if resolved) and the contest entry fee in cents.
 */
export function buildOpenSlotWatchFromQueueParams(args: QueueArgs): H2hOpenSlotWatchPayload {
  const p = buildBackendQueueParams(args);
  const q = args.quickCtx;

  if (q?.isQuickMatchWildcard) {
    const tiers = (p.quickMatchAllowedEntryCents ?? []).map((x) => Math.max(0, Math.floor(Number(x))));
    return {
      enabled: true,
      entryCents: tiers.length > 0 ? tiers : [0],
      gameKeys: null,
    };
  }

  const gk = (p.gameKey ?? '').trim();
  const specificGame = gk.length > 0 && gk !== H2H_QUICK_MATCH_GAME_KEY;
  const ec = Math.max(0, Math.floor(p.entryFeeWalletCents));

  return {
    enabled: true,
    entryCents: [ec],
    gameKeys: specificGame ? [gk] : null,
  };
}
