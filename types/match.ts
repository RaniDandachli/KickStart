import type { QueueKind } from '@/store/matchmakingStore';

/** Client-side match model until gameplay engine exists. */
export interface KickClashMatchSession {
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
