import type { BracketBoardMatchInput } from '@/features/tournaments/BracketEliminationBoard';

/** Wireframe for single-elimination (power-of-two slots) before seeds exist. */
export function buildEmptySingleEliminationSkeleton(podSize: number): BracketBoardMatchInput[] {
  const n = Math.max(2, Math.min(256, Math.floor(podSize)));
  const rounds = Math.ceil(Math.log2(n));
  const out: BracketBoardMatchInput[] = [];
  for (let r = 0; r < rounds; r++) {
    const count = 2 ** (rounds - 1 - r);
    for (let i = 0; i < count; i++) {
      out.push({
        id: `sk-${r}-${i}`,
        roundIndex: r,
        matchIndex: i,
        playerAId: null,
        playerBId: null,
        winnerId: null,
      });
    }
  }
  return out;
}
