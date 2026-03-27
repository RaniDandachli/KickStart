import type { QueueKind } from '@/store/matchmakingStore';

/** Client-side match model until gameplay engine exists. */
export interface KickClashMatchSession {
  id: string;
  mode: QueueKind;
  localPlayerId: string;
  opponentId: string;
  scoreSelf: number;
  scoreOpponent: number;
  /** epoch ms */
  startedAt: number;
  durationSec: number;
}

export type MatchResultReason = 'time' | 'forfeit' | 'disconnect' | 'normal';

export interface MatchFinishPayload {
  winnerId: string;
  finalScore: { self: number; opponent: number };
  reason: MatchResultReason;
}
