import { mulberry32 } from '@/minigames/core/seededRng';

export function makeRng(seed: number): () => number {
  return mulberry32(seed >>> 0);
}

export function rngFloat(rng: () => number, a: number, b: number): number {
  return a + rng() * (b - a);
}

export function rngInt(rng: () => number, a: number, b: number): number {
  return Math.floor(a + rng() * (b - a + 1));
}
