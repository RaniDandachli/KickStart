import { TILE_CLASH } from '@/minigames/config/tuning';
import { mulberry32 } from '@/minigames/core/seededRng';

export interface Tile {
  id: number;
  col: number;
  y: number;
  kind: 'good' | 'bad';
}

export interface TileClashState {
  tiles: Tile[];
  nextId: number;
  spawnAcc: number;
  scrollPerMs: number;
  timeLeftMs: number;
  scoreP1: number;
  scoreP2: number;
  rng: ReturnType<typeof mulberry32>;
  aiRng: ReturnType<typeof mulberry32>;
  missedP1: Set<number>;
  missedP2: Set<number>;
  tappedP1: Set<number>;
  tappedP2: Set<number>;
}

export function createTileClashState(seed: number): TileClashState {
  const rng = mulberry32(seed);
  const aiRng = mulberry32((seed ^ 0x85ebca6b) >>> 0);
  return {
    tiles: [],
    nextId: 1,
    spawnAcc: 400,
    scrollPerMs: TILE_CLASH.scrollBasePerMs,
    timeLeftMs: TILE_CLASH.roundMs,
    scoreP1: 0,
    scoreP2: 0,
    rng,
    aiRng,
    missedP1: new Set(),
    missedP2: new Set(),
    tappedP1: new Set(),
    tappedP2: new Set(),
  };
}

function spawnTile(state: TileClashState): void {
  const col = Math.floor(state.rng() * TILE_CLASH.cols);
  const kind: 'good' | 'bad' = state.rng() < TILE_CLASH.goodChance ? 'good' : 'bad';
  state.tiles.push({
    id: state.nextId++,
    col,
    y: -TILE_CLASH.tileH - 4,
    kind,
  });
}

function inHitZone(y: number): boolean {
  return y + TILE_CLASH.tileH >= TILE_CLASH.hitZoneTop && y <= TILE_CLASH.hitZoneBottom;
}

function findTileInColumn(state: TileClashState, col: number): Tile | undefined {
  let bestGood: Tile | undefined;
  let bestGoodY = -1e9;
  let bestBad: Tile | undefined;
  let bestBadY = -1e9;
  for (const t of state.tiles) {
    if (t.col !== col || !inHitZone(t.y)) continue;
    if (t.kind === 'good') {
      if (t.y > bestGoodY) {
        bestGoodY = t.y;
        bestGood = t;
      }
    } else if (t.y > bestBadY) {
      bestBadY = t.y;
      bestBad = t;
    }
  }
  return bestGood ?? bestBad;
}

function timingBonus(y: number): number {
  const mid = (TILE_CLASH.hitZoneTop + TILE_CLASH.hitZoneBottom) / 2;
  const tileMid = y + TILE_CLASH.tileH / 2;
  const err = Math.abs(tileMid - mid);
  const span = (TILE_CLASH.hitZoneBottom - TILE_CLASH.hitZoneTop) / 2;
  const t = 1 - Math.min(1, err / Math.max(1, span));
  return t * TILE_CLASH.timingBonusMax;
}

function applyMisses(state: TileClashState): void {
  for (const t of state.tiles) {
    if (t.kind !== 'good') continue;
    if (t.y > TILE_CLASH.hitZoneBottom + 6) {
      if (!state.tappedP1.has(t.id) && !state.missedP1.has(t.id)) {
        state.missedP1.add(t.id);
        state.scoreP1 = Math.max(0, state.scoreP1 - TILE_CLASH.missPenalty);
      }
      if (!state.tappedP2.has(t.id) && !state.missedP2.has(t.id)) {
        state.missedP2.add(t.id);
        state.scoreP2 = Math.max(0, state.scoreP2 - TILE_CLASH.missPenalty);
      }
    }
  }
}

export function tapColumn(state: TileClashState, col: number, who: 1 | 2): void {
  const t = findTileInColumn(state, col);
  if (!t) return;
  const tapped = who === 1 ? state.tappedP1 : state.tappedP2;
  if (tapped.has(t.id)) return;
  tapped.add(t.id);
  if (t.kind === 'good') {
    const bonus = timingBonus(t.y);
    const pts = TILE_CLASH.goodTap + bonus;
    if (who === 1) state.scoreP1 += pts;
    else state.scoreP2 += pts;
  } else {
    if (who === 1) state.scoreP1 = Math.max(0, state.scoreP1 - TILE_CLASH.badTapPenalty);
    else state.scoreP2 = Math.max(0, state.scoreP2 - TILE_CLASH.badTapPenalty);
  }
}

export function tileClashAiPick(state: TileClashState): number {
  const rng = state.aiRng;
  if (rng() > 0.22) return -1;
  const candidates: number[] = [];
  for (let c = 0; c < TILE_CLASH.cols; c++) {
    const t = findTileInColumn(state, c);
    if (t && t.kind === 'good' && !state.tappedP2.has(t.id)) candidates.push(c);
  }
  if (candidates.length === 0) return -1;
  return candidates[Math.floor(rng() * candidates.length)];
}

export function stepTileClash(state: TileClashState, dtMs: number): void {
  state.timeLeftMs = Math.max(0, state.timeLeftMs - dtMs);
  state.scrollPerMs += TILE_CLASH.scrollAccelPerMs2 * dtMs;
  const dy = state.scrollPerMs * dtMs;
  for (const t of state.tiles) {
    t.y += dy;
  }
  state.spawnAcc += dtMs;
  if (state.spawnAcc >= TILE_CLASH.spawnEveryMs) {
    spawnTile(state);
    state.spawnAcc = 0;
  }
  applyMisses(state);
  state.tiles = state.tiles.filter((t) => t.y < TILE_CLASH.laneH + 40);
}
