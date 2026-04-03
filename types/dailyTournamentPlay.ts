import type { MatchFinishPayload } from '@/types/match';

/** Props for the daily elimination event match flow. */
export type DailyTournamentBundle = {
  opponentDisplayName: string;
  /** Opponent’s posted score for this round (paired with your run for the result screen). */
  opponentRoundScore: number;
  forcedOutcome: 'win' | 'lose';
  localPlayerId: string;
  opponentId: string;
  onComplete: (payload: MatchFinishPayload) => void;
};
