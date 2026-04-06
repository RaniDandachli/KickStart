import type { MatchFinishPayload } from '@/types/match';

/** Props for the daily elimination event match flow. */
export type DailyTournamentBundle = {
  opponentDisplayName: string;
  /** Opponent’s posted score for this round (paired with your run for the result screen). */
  opponentRoundScore: number;
  forcedOutcome: 'win' | 'lose';
  localPlayerId: string;
  opponentId: string;
  /**
   * Unique per bracket match (e.g. `${dayKey}|r3|${userId}`). Drives varied final score margins on the results card
   * so wins/losses don’t always look like +/-1.
   */
  scoreVarianceKey?: string;
  onComplete: (payload: MatchFinishPayload) => void;
};
