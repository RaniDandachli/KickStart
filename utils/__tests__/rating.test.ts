import {
  applyRankedResult,
  expectedScore,
  ratingDefaults,
  ratingDelta,
  shouldUpdateRating,
} from '../rating';

describe('expectedScore', () => {
  it('is 0.5 for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it('favors higher-rated player', () => {
    expect(expectedScore(1600, 1500)).toBeGreaterThan(0.5);
    expect(expectedScore(1500, 1600)).toBeLessThan(0.5);
  });
});

describe('ratingDelta', () => {
  it('increases rating on upset-friendly win vs stronger opponent', () => {
    const weaker: typeof ratingDefaults = {
      ...ratingDefaults,
      rating: 1400,
      provisionalGamesRemaining: 0,
    };
    const stronger: typeof ratingDefaults = {
      ...ratingDefaults,
      rating: 1600,
      provisionalGamesRemaining: 0,
    };
    const { delta, nextPlayer } = ratingDelta(weaker, stronger, { actualScore: 1 });
    expect(delta).toBeGreaterThan(0);
    expect(nextPlayer.rating).toBe(weaker.rating + delta);
  });

  it('uses higher K while provisional', () => {
    const prov = { ...ratingDefaults, provisionalGamesRemaining: 5 };
    const est = { ...ratingDefaults, provisionalGamesRemaining: 0 };
    const provDelta = ratingDelta(prov, est, { actualScore: 1 }).delta;
    const estDelta = ratingDelta(
      { ...prov, provisionalGamesRemaining: 0 },
      est,
      { actualScore: 1 }
    ).delta;
    expect(Math.abs(provDelta)).toBeGreaterThan(Math.abs(estDelta));
  });
});

describe('applyRankedResult', () => {
  it('raises winner and lowers loser symmetrically in total change magnitude trend', () => {
    const a = { ...ratingDefaults, rating: 1500, provisionalGamesRemaining: 0 };
    const b = { ...ratingDefaults, rating: 1500, provisionalGamesRemaining: 0 };
    const res = applyRankedResult(a, b);
    expect(res.winnerDelta).toBeGreaterThan(0);
    expect(res.loserDelta).toBeLessThan(0);
  });
});

describe('shouldUpdateRating', () => {
  it('is ranked-only', () => {
    expect(shouldUpdateRating('ranked')).toBe(true);
    expect(shouldUpdateRating('casual')).toBe(false);
  });
});
