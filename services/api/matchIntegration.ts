import { getSupabase } from '@/supabase/client';
import type { RatingRow } from '@/types/database';
import type { QueueKind } from '@/store/matchmakingStore';
import { applyRankedResult, ratingDefaults } from '@/utils/rating';

/**
 * Integration point after a ranked match completes — head-to-head results are persisted via
 * `recordH2hMatchResultViaEdge` in `services/api/h2hMatchSession.ts` (see `recordMatchResult` Edge Function).
 */
/** Preview rating change if `self` wins vs `opponent` (ranked only at apply-time). */
export function previewRankedDeltasIfSelfWins(params: {
  selfRow: RatingRow;
  opponentRow: RatingRow;
}): { winner: typeof ratingDefaults; loser: typeof ratingDefaults; winnerDelta: number; loserDelta: number } {
  const self = {
    rating: params.selfRow.rating,
    gamesPlayed: params.selfRow.games_played,
    provisionalGamesRemaining: params.selfRow.provisional_games_remaining,
  };
  const opp = {
    rating: params.opponentRow.rating,
    gamesPlayed: params.opponentRow.games_played,
    provisionalGamesRemaining: params.opponentRow.provisional_games_remaining,
  };
  return applyRankedResult(self, opp);
}

export function shouldApplyRating(mode: QueueKind): boolean {
  return mode === 'ranked';
}

export async function submitDisputePlaceholder(matchSessionId: string, notes: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('match_sessions')
    .update({
      dispute_status: 'submitted',
      evidence_notes: notes,
    })
    .eq('id', matchSessionId);
  if (error) throw error;
}
