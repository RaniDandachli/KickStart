import type { QueueKind } from '@/store/matchmakingStore';
import type { H2hSkillContestGameKey } from '@/lib/h2hSkillContestGames';

/** Client-side match model for H2H placeholder / generic flows. */
export interface HeadToHeadMatchSession {
  id: string;
  mode: QueueKind;
  localPlayerId: string;
  opponentId: string;
  /** Shown in HUD (from matchmaking). */
  opponentDisplayName?: string;
  /** Listed prize USD for fee matches (UI + payout). */
  listedPrizeUsd?: number;
  entryFeeUsd?: number;
  scoreSelf: number;
  scoreOpponent: number;
  /** epoch ms */
  startedAt: number;
  durationSec: number;
}

export type MatchResultReason = 'time' | 'forfeit' | 'disconnect' | 'normal';

export interface MatchFinishPayload {
  /** Local player id, opponent id, or `'draw'` when scores tie. */
  winnerId: string;
  finalScore: { self: number; opponent: number };
  reason: MatchResultReason;
}

export type AsyncH2hQueueSubmit = {
  gameKey: H2hSkillContestGameKey;
  mode: QueueKind;
  entryFeeWalletCents: number;
  listedPrizeUsdCents: number;
};

/** @deprecated use AsyncH2hQueueSubmit */
export type AsyncH2hTapDashQueueSubmit = AsyncH2hQueueSubmit;

/** Props for embedding a minigame inside an H2H `match_sessions` flow (server-validated score + poll). */
export type H2hSkillContestBundle = {
  matchSessionId: string;
  localPlayerId: string;
  opponentId: string;
  opponentDisplayName: string;
  onComplete: (p: MatchFinishPayload) => void;
  /**
   * Host already has a server score (async host). Skip posting again; poll until opponent finishes.
   */
  asyncHostSkipSubmit?: boolean;
};
