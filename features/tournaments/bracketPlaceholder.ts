import type { BracketMatchPreview } from '@/features/tournaments/BracketTreePreview';

/** Wireframe for single-elimination (power-of-two slots) before seeds exist. */
export function buildEmptySingleEliminationSkeleton(podSize: number): BracketMatchPreview[] {
  const n = Math.max(2, Math.min(256, Math.floor(podSize)));
  const rounds = Math.ceil(Math.log2(n));
  const out: BracketMatchPreview[] = [];
  for (let r = 0; r < rounds; r++) {
    const count = 2 ** (rounds - 1 - r);
    for (let i = 0; i < count; i++) {
      out.push({ id: `sk-${r}-${i}`, roundIndex: r });
    }
  }
  return out;
}
