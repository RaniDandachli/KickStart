/**
 * Single-elimination pairing helpers. Pure logic for tests + Edge Function parity.
 * TODO: Seeding, re-seeding on no-shows, double elimination.
 */

export interface BracketPlayer {
  id: string;
  seed: number;
}

export interface BracketMatchSlot {
  roundIndex: number;
  matchIndex: number;
  playerAId: string | null;
  playerBId: string | null;
}

/** Pair adjacent seeds (1v2, 3v4, …). Odd count yields bye (null opponent). */
export function pairPlayersForRound(players: BracketPlayer[]): BracketMatchSlot[] {
  const sorted = [...players].sort((a, b) => a.seed - b.seed);
  const slots: BracketMatchSlot[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const a = sorted[i] ?? null;
    const b = sorted[i + 1] ?? null;
    slots.push({
      roundIndex: 0,
      matchIndex: slots.length,
      playerAId: a?.id ?? null,
      playerBId: b?.id ?? null,
    });
  }
  return slots;
}

export function nextRoundMatchCount(currentMatches: number): number {
  return Math.ceil(currentMatches / 2);
}

/** Build round labels for UI (Finals, Semis, …). */
export function roundLabel(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - roundIndex;
  if (fromEnd === 1) return 'Finals';
  if (fromEnd === 2) return 'Semifinals';
  if (fromEnd === 3) return 'Quarterfinals';
  return `Round ${roundIndex + 1}`;
}

export function singleEliminationRoundCount(playerCount: number): number {
  if (playerCount <= 1) return 0;
  return Math.ceil(Math.log2(playerCount));
}
