import {
  HOP_MS,
  LANE_COUNT,
  ROW_BUFFER,
  SAFE_ROW_CHANCE,
  SAFE_ZONE_ROWS,
  SPEED_BASE,
  SPEED_MAX,
  SPEED_RAND,
  SPEED_ROW_SCALE,
  START_COL,
  SURGE_DRAIN_PER_MS,
  SURGE_DURATION_MS,
  SURGE_MAX,
  SURGE_NODE_BOOST,
  SURGE_NODE_CHANCE,
  SURGE_PER_HOP,
  SURGE_SLOW,
  VEHICLE_COLORS,
} from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Vehicle = {
  id: number;
  col: number;   // continuous float (left edge)
  width: number; // in lane units (1 or 2)
  speed: number; // lanes/sec — positive = right, negative = left
  colorIdx: number;
};

export type RowKind = 'safe' | 'traffic';

export type GridRow = {
  rowId: number;
  kind: RowKind;
  vehicles: Vehicle[];
  surgeNodeCol: number | null;
  surgeCollected: boolean;
};

/** Mutable game ref — kept in useRef, never triggers re-render directly. */
export type GameRef = {
  rows: Map<number, GridRow>;
  maxRow: number;

  playerRow: number;
  playerCol: number;

  // hop animation
  hopping: boolean;
  hopFromRow: number;
  hopFromCol: number;
  hopTargetRow: number;
  hopTargetCol: number;
  hopT: number; // 0-1

  score: number;       // max row reached
  tapCount: number;    // total moves made

  alive: boolean;
  deathFlash: number;  // ms countdown for flicker

  surgeCharge: number; // 0-100
  surgeActive: boolean;
  surgeTimeLeft: number; // ms

  nextId: number;
  rng: () => number;
};

// ─── RNG (mulberry32) ────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Row generation ──────────────────────────────────────────────────────────

function generateRow(g: GameRef, rowId: number): GridRow {
  const rng = g.rng;

  if (rowId < SAFE_ZONE_ROWS) {
    const surgeNodeCol = rowId > 0 && rng() < SURGE_NODE_CHANCE ? Math.floor(rng() * LANE_COUNT) : null;
    return { rowId, kind: 'safe', vehicles: [], surgeNodeCol, surgeCollected: false };
  }

  const kind: RowKind = rng() < SAFE_ROW_CHANCE ? 'safe' : 'traffic';
  const surgeNodeCol = rng() < SURGE_NODE_CHANCE ? Math.floor(rng() * LANE_COUNT) : null;

  if (kind === 'safe') {
    return { rowId, kind, vehicles: [], surgeNodeCol, surgeCollected: false };
  }

  const difficulty = Math.min(1, rowId / 60); // 0-1 over 60 rows
  const baseSpeed = Math.min(SPEED_MAX, SPEED_BASE + SPEED_ROW_SCALE * rowId + rng() * SPEED_RAND);
  const dir = rng() < 0.5 ? 1 : -1;
  const colorIdx = Math.floor(rng() * VEHICLE_COLORS.length);

  // 1-3 vehicles depending on difficulty
  const maxN = 1 + Math.floor(difficulty * 2 + 0.5);
  const numV = 1 + Math.floor(rng() * maxN);

  const vehicles: Vehicle[] = [];
  let cursor = rng() * 2.5;

  for (let i = 0; i < numV; i++) {
    const width = rng() < 0.22 ? 2 : 1;
    if (cursor + width > LANE_COUNT + 3) break;

    const col = dir > 0 ? cursor : LANE_COUNT - cursor - width;
    vehicles.push({
      id: g.nextId++,
      col,
      width,
      speed: dir * baseSpeed * (0.88 + rng() * 0.24),
      colorIdx,
    });
    cursor += width + 0.9 + rng() * 2.1;
  }

  return { rowId, kind: 'traffic', vehicles, surgeNodeCol, surgeCollected: false };
}

// ─── Construction ────────────────────────────────────────────────────────────

export function createGameRef(seed: number): GameRef {
  const g: GameRef = {
    rows: new Map(),
    maxRow: 0,
    playerRow: 0,
    playerCol: START_COL,
    hopping: false,
    hopFromRow: 0,
    hopFromCol: START_COL,
    hopTargetRow: 0,
    hopTargetCol: START_COL,
    hopT: 1,
    score: 0,
    tapCount: 0,
    alive: true,
    deathFlash: 0,
    surgeCharge: 0,
    surgeActive: false,
    surgeTimeLeft: 0,
    nextId: 1,
    rng: mulberry32(seed),
  };

  for (let r = 0; r <= ROW_BUFFER; r++) {
    g.rows.set(r, generateRow(g, r));
    g.maxRow = r;
  }
  return g;
}

// ─── Collision ───────────────────────────────────────────────────────────────

function vehicleCoversCol(v: Vehicle, col: number): boolean {
  const center = col + 0.5;
  return v.col < center && v.col + v.width > center;
}

function isHitByTraffic(g: GameRef, row: number, col: number): boolean {
  const r = g.rows.get(row);
  if (!r || r.kind !== 'traffic') return false;
  return r.vehicles.some((v) => vehicleCoversCol(v, col));
}

// ─── Input ───────────────────────────────────────────────────────────────────

export function tryHop(g: GameRef, dr: number, dc: number): boolean {
  if (!g.alive || g.hopping) return false;

  const newRow = g.playerRow + dr;
  const newCol = g.playerCol + dc;

  if (newCol < 0 || newCol >= LANE_COUNT) return false;
  if (newRow < 0) return false;

  g.hopFromRow = g.playerRow;
  g.hopFromCol = g.playerCol;
  g.hopTargetRow = newRow;
  g.hopTargetCol = newCol;
  g.hopT = 0;
  g.hopping = true;
  g.tapCount += 1;
  return true;
}

export function tryActivateSurge(g: GameRef): boolean {
  if (!g.alive || g.surgeActive || g.surgeCharge < SURGE_MAX) return false;
  g.surgeActive = true;
  g.surgeTimeLeft = SURGE_DURATION_MS;
  g.surgeCharge = 0;
  return true;
}

// ─── Step ────────────────────────────────────────────────────────────────────

export function stepGame(g: GameRef, dtMs: number): void {
  if (!g.alive) {
    g.deathFlash = Math.max(0, g.deathFlash - dtMs);
    return;
  }

  const speedMul = g.surgeActive ? SURGE_SLOW : 1.0;

  // Surge timer
  if (g.surgeActive) {
    g.surgeTimeLeft = Math.max(0, g.surgeTimeLeft - dtMs);
    g.surgeCharge = Math.max(0, g.surgeCharge - SURGE_DRAIN_PER_MS * dtMs);
    if (g.surgeTimeLeft <= 0) {
      g.surgeActive = false;
      g.surgeCharge = 0;
    }
  }

  // Hop animation
  if (g.hopping) {
    g.hopT = Math.min(1, g.hopT + dtMs / HOP_MS);

    if (g.hopT >= 1) {
      g.playerRow = g.hopTargetRow;
      g.playerCol = g.hopTargetCol;
      g.hopping = false;

      // Collect surge node
      const row = g.rows.get(g.playerRow);
      if (row?.surgeNodeCol === g.playerCol && !row.surgeCollected) {
        row.surgeCollected = true;
        g.surgeCharge = Math.min(SURGE_MAX, g.surgeCharge + SURGE_NODE_BOOST);
      }

      // Forward hop bonus
      if (g.playerRow > g.score) {
        g.score = g.playerRow;
        if (!g.surgeActive) {
          g.surgeCharge = Math.min(SURGE_MAX, g.surgeCharge + SURGE_PER_HOP);
        }
      }

      // Landing collision
      if (isHitByTraffic(g, g.playerRow, g.playerCol)) {
        kill(g);
        return;
      }
    }
  }

  // Move vehicles
  for (const [rowId, row] of g.rows) {
    if (row.kind !== 'traffic') continue;

    for (const v of row.vehicles) {
      v.col += v.speed * speedMul * (dtMs / 1000);

      // Wrap-around
      if (v.speed > 0 && v.col > LANE_COUNT) v.col = -v.width;
      if (v.speed < 0 && v.col + v.width < 0) v.col = LANE_COUNT;
    }

    // Continuous collision while player idles on this row
    if (!g.hopping && rowId === g.playerRow) {
      if (isHitByTraffic(g, g.playerRow, g.playerCol)) {
        kill(g);
        return;
      }
    }
  }

  // Generate rows ahead
  while (g.maxRow < g.playerRow + ROW_BUFFER) {
    g.maxRow++;
    g.rows.set(g.maxRow, generateRow(g, g.maxRow));
  }

  // Prune rows far behind
  const minKeep = g.playerRow - 8;
  for (const id of g.rows.keys()) {
    if (id < minKeep) g.rows.delete(id);
  }
}

function kill(g: GameRef): void {
  g.alive = false;
  g.deathFlash = 700;
  g.hopping = false;
}

// ─── View helpers ─────────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Animated display position (fractional row/col during hop arc). */
export function getDispPos(g: GameRef): { dispRow: number; dispCol: number } {
  if (!g.hopping || g.hopT >= 1) {
    return { dispRow: g.playerRow, dispCol: g.playerCol };
  }
  const t = easeOutCubic(g.hopT);
  return {
    dispRow: g.hopFromRow + (g.hopTargetRow - g.hopFromRow) * t,
    dispCol: g.hopFromCol + (g.hopTargetCol - g.hopFromCol) * t,
  };
}

export { VEHICLE_COLORS };
