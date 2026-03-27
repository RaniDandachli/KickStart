/**
 * Elo-style rating (ranked queue only). Pure functions for testability.
 * TODO: Tune K/provisional values against live match volume.
 */

export type QueueMode = 'ranked' | 'casual';

export interface RatingState {
  rating: number;
  gamesPlayed: number;
  /** Remaining games with elevated K-factor / provisional behavior */
  provisionalGamesRemaining: number;
}

const DEFAULT_RATING = 1500;
const PROVISIONAL_K = 40;
const ESTABLISHED_K = 16;
const PROVISIONAL_GAMES_START = 10;

export const ratingDefaults: RatingState = {
  rating: DEFAULT_RATING,
  gamesPlayed: 0,
  provisionalGamesRemaining: PROVISIONAL_GAMES_START,
};

export function expectedScore(playerRating: number, opponentRating: number): number {
  const diff = (opponentRating - playerRating) / 400;
  return 1 / (1 + Math.pow(10, diff));
}

function kFactor(state: RatingState): number {
  return state.provisionalGamesRemaining > 0 ? PROVISIONAL_K : ESTABLISHED_K;
}

export interface MatchOutcome {
  /** 1 = win, 0.5 = draw, 0 = loss */
  actualScore: number;
}

export function ratingDelta(
  player: RatingState,
  opponent: RatingState,
  outcome: MatchOutcome
): { delta: number; nextPlayer: RatingState; nextOpponent: RatingState } {
  const k = kFactor(player);
  const exp = expectedScore(player.rating, opponent.rating);
  const delta = Math.round(k * (outcome.actualScore - exp));

  const nextPlayer: RatingState = {
    rating: player.rating + delta,
    gamesPlayed: player.gamesPlayed + 1,
    provisionalGamesRemaining: Math.max(0, player.provisionalGamesRemaining - 1),
  };

  const oppOutcome: MatchOutcome = {
    actualScore: 1 - outcome.actualScore,
  };
  const kOpp = kFactor(opponent);
  const expOpp = expectedScore(opponent.rating, player.rating);
  const deltaOpp = Math.round(kOpp * (oppOutcome.actualScore - expOpp));

  const nextOpponent: RatingState = {
    rating: opponent.rating + deltaOpp,
    gamesPlayed: opponent.gamesPlayed + 1,
    provisionalGamesRemaining: Math.max(0, opponent.provisionalGamesRemaining - 1),
  };

  return { delta, nextPlayer, nextOpponent };
}

export function applyRankedResult(
  winner: RatingState,
  loser: RatingState
): {
  winner: RatingState;
  loser: RatingState;
  winnerDelta: number;
  loserDelta: number;
} {
  const w = ratingDelta(winner, loser, { actualScore: 1 });
  const l = ratingDelta(loser, winner, { actualScore: 0 });
  return {
    winner: w.nextPlayer,
    loser: l.nextPlayer,
    winnerDelta: w.delta,
    loserDelta: l.delta,
  };
}

export function shouldUpdateRating(mode: QueueMode): boolean {
  return mode === 'ranked';
}
