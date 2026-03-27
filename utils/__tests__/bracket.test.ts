import {
  pairPlayersForRound,
  nextRoundMatchCount,
  roundLabel,
  singleEliminationRoundCount,
  type BracketPlayer,
} from '../bracket';

describe('pairPlayersForRound', () => {
  it('pairs seeds in order', () => {
    const players: BracketPlayer[] = [
      { id: 'a', seed: 1 },
      { id: 'b', seed: 2 },
      { id: 'c', seed: 3 },
      { id: 'd', seed: 4 },
    ];
    const slots = pairPlayersForRound(players);
    expect(slots).toEqual([
      { roundIndex: 0, matchIndex: 0, playerAId: 'a', playerBId: 'b' },
      { roundIndex: 0, matchIndex: 1, playerAId: 'c', playerBId: 'd' },
    ]);
  });

  it('handles bye when odd count', () => {
    const players: BracketPlayer[] = [
      { id: 'a', seed: 1 },
      { id: 'b', seed: 2 },
      { id: 'c', seed: 3 },
    ];
    const slots = pairPlayersForRound(players);
    expect(slots[1].playerBId).toBeNull();
  });
});

describe('nextRoundMatchCount', () => {
  it('halves matches rounding up', () => {
    expect(nextRoundMatchCount(4)).toBe(2);
    expect(nextRoundMatchCount(3)).toBe(2);
  });
});

describe('roundLabel', () => {
  it('labels finals', () => {
    expect(roundLabel(2, 3)).toBe('Finals');
    expect(roundLabel(1, 3)).toBe('Semifinals');
  });
});

describe('singleEliminationRoundCount', () => {
  it('matches log2 ceiling', () => {
    expect(singleEliminationRoundCount(8)).toBe(3);
    expect(singleEliminationRoundCount(5)).toBe(3);
  });
});
