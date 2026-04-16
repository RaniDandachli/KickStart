import { H2H_QUICK_MATCH_GAME_KEY, type H2hGameKey } from '@/lib/homeOpenMatches';
import type { QueueKind } from '@/store/matchmakingStore';

export type QuickMatchCtx = {
  isFreeCasual: boolean;
  entryUsd: number;
  prizeUsd: number;
  gameTitle: string;
  gameKey: H2hGameKey | typeof H2H_QUICK_MATCH_GAME_KEY;
  waiterId: string;
  opponentName: string;
  isQuickMatchWildcard?: boolean;
  maxAffordableEntryCents?: number;
  allowedEntryCents?: number[];
  exactTierCents?: { entry: number; prize: number };
};

/** RPC payload mirrored in `matchmakingStore.queuePollSnapshot` for global polling + realtime. */
export type H2hQueuePollPayload = {
  mode: QueueKind;
  gameKey: string;
  entryFeeWalletCents: number;
  listedPrizeUsdCents: number;
  maxAffordableEntryCents?: number;
  quickMatchAllowedEntryCents?: number[];
};

/** Snapshot for accept / lobby navigation when modal is hosted outside `QueueScreen`. */
export type MatchmakingAcceptRoute = {
  userId: string;
  mode: QueueKind;
  entryFeeUsd?: number;
  listedPrizeUsd?: number;
  gameKey?: string;
  queueTierCents?: { entry: number; prize: number };
  returnToHref?: string;
  quickMatch: boolean;
  quickMatchCtx: QuickMatchCtx | null;
};
