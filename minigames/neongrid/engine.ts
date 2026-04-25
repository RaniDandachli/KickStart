import {
  HOP_MS,
  LANE_COUNT,
  LOG_MAX_WIDTH,
  LOG_MIN_WIDTH,
  LOG_SPEED_BASE,
  LOG_SPEED_MAX,
  LOG_SPEED_RAND,
  RIVER_ROW_CHANCE,
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
  TREE_CHANCE,
  VEHICLE_COLORS,
} from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Vehicle = {
  id: number;
  col: number;
  width: number;  // 1 or 2 lane units
  speed: number;  // lanes/sec, positive = right
  colorIdx: number;
};

export type Log = {
  id: number;
  col: number;
  width: number;  // 2-3 lane units
  speed: number;
};

export type RowKind = 'safe' | 'road' | 'river';

export type GridRow = {
  rowId: number;
  kind: RowKind;
  vehicles: Vehicle[];
  logs: Log[];
  /** true = tree/obstacle blocks movement (safe rows only) */
  treeMask: readonly boolean[];
  surgeNodeCol: number | null;
  surgeCollected: boolean;
};

export type GameRef = {
  rows: Map<number, GridRow>;
  maxRow: number;

  playerRow: number;
  playerCol: number;

  /** ID of the log we're riding, or null */
  ridingLogId: number | null;

  hopping: boolean;
  hopFromRow: number;
  hopFromCol: number;
  hopTargetRow: number;
  hopTargetCol: number;
  hopT: number;

  /** Squash/stretch scale for cartoon bop (1 = normal) */
  bopScale: number;

  score: number;
  tapCount: number;
  alive: boolean;
  deathFlash: number;

  surgeCharge: number;
  surgeActive: boolean;
  surgeTimeLeft: number;

  nextId: number;
  rng: () => number;
};

// ─── RNG ─────────────────────────────────────────────────────────────────────

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

function buildTreeMask(rng: () => number): readonly boolean[] {
  const mask: boolean[] = [];
  for (let i = 0; i < LANE_COUNT; i++) {
    mask.push(i !== START_COL && rng() < TREE_CHANCE);
  }
  if (mask.every(Boolean)) mask[START_COL] = false;
  return mask;
}

function generateRow(g: GameRef, rowId: number): GridRow {
  const rng = g.rng;

  if (rowId < SAFE_ZONE_ROWS) {
    const surgeNodeCol = rowId > 0 && rng() < SURGE_NODE_CHANCE
      ? Math.floor(rng() * LANE_COUNT) : null;
    return {
      rowId, kind: 'safe', vehicles: [], logs: [],
      treeMask: Array(LANE_COUNT).fill(false),
      surgeNodeCol, surgeCollected: false,
    };
  }

  const roll = rng();
  const kind: RowKind = roll < SAFE_ROW_CHANCE ? 'safe'
    : roll < SAFE_ROW_CHANCE + RIVER_ROW_CHANCE ? 'river'
    : 'road';

  const surgeNodeCol = rng() < SURGE_NODE_CHANCE
    ? Math.floor(rng() * LANE_COUNT) : null;

  if (kind === 'safe') {
    return {
      rowId, kind, vehicles: [], logs: [],
      treeMask: buildTreeMask(rng),
      surgeNodeCol, surgeCollected: false,
    };
  }

  if (kind === 'river') {
    const dir = rng() < 0.5 ? 1 : -1;
    const speed = dir * Math.min(LOG_SPEED_MAX, LOG_SPEED_BASE + rng() * LOG_SPEED_RAND);
    const logs: Log[] = [];
    let cursor = rng() * 1.5;
    for (let i = 0; i < 4; i++) {
      const w = LOG_MIN_WIDTH + Math.floor(rng() * (LOG_MAX_WIDTH - LOG_MIN_WIDTH + 1));
      if (cursor + w > LANE_COUNT + 5) break;
      const col = dir > 0 ? cursor : LANE_COUNT - cursor - w;
      logs.push({ id: g.nextId++, col, width: w, speed });
      cursor += w + 1 + rng() * 2.5;
    }
    return { rowId, kind, vehicles: [], logs, treeMask: [], surgeNodeCol, surgeCollected: false };
  }

  // road
  const difficulty = Math.min(1, rowId / 60);
  const baseSpeed = Math.min(SPEED_MAX, SPEED_BASE + SPEED_ROW_SCALE * rowId + rng() * SPEED_RAND);
  const dir = rng() < 0.5 ? 1 : -1;
  const colorIdx = Math.floor(rng() * VEHICLE_COLORS.length);
  const maxN = 1 + Math.floor(difficulty * 2 + 0.5);
  const numV = 1 + Math.floor(rng() * maxN);
  const vehicles: Vehicle[] = [];
  let cursor = rng() * 2;
  for (let i = 0; i < numV; i++) {
    const width = rng() < 0.2 ? 2 : 1;
    if (cursor + width > LANE_COUNT + 3) break;
    const col = dir > 0 ? cursor : LANE_COUNT - cursor - width;
    vehicles.push({
      id: g.nextId++, col, width,
      speed: dir * baseSpeed * (0.88 + rng() * 0.24),
      colorIdx,
    });
    cursor += width + 0.8 + rng() * 2;
  }
  return { rowId, kind: 'road', vehicles, logs: [], treeMask: [], surgeNodeCol, surgeCollected: false };
}

// ─── Construction ─────────────────────────────────────────────────────────────

export function createGameRef(seed: number): GameRef {
  const g: GameRef = {
    rows: new Map(), maxRow: 0,
    playerRow: 0, playerCol: START_COL,
    ridingLogId: null,
    hopping: false,
    hopFromRow: 0, hopFromCol: START_COL,
    hopTargetRow: 0, hopTargetCol: START_COL,
    hopT: 1,
    bopScale: 1,
    score: 0, tapCount: 0,
    alive: true, deathFlash: 0,
    surgeCharge: 0, surgeActive: false, surgeTimeLeft: 0,
    nextId: 1, rng: mulberry32(seed),
  };
  for (let r = 0; r <= ROW_BUFFER; r++) {
    g.rows.set(r, generateRow(g, r));
    g.maxRow = r;
  }
  return g;
}

// ─── Collision helpers ────────────────────────────────────────────────────────

function covers(v: { col: number; width: number }, col: number): boolean {
  const center = col + 0.5;
  return v.col < center && v.col + v.width > center;
}

function getLogAtPos(g: GameRef, row: number, col: number): Log | null {
  const r = g.rows.get(row);
  if (!r || r.kind !== 'river') return null;
  return r.logs.find((l) => covers(l, col)) ?? null;
}

function isBlockedByTree(g: GameRef, row: number, col: number): boolean {
  const r = g.rows.get(row);
  return !!(r && r.kind === 'safe' && r.treeMask[col]);
}

function isHitByCar(g: GameRef, row: number, col: number): boolean {
  const r = g.rows.get(row);
  return !!(r && r.kind === 'road' && r.vehicles.some((v) => covers(v, col)));
}

// ─── Input ────────────────────────────────────────────────────────────────────

export function tryHop(g: GameRef, dr: number, dc: number): boolean {
  if (!g.alive || g.hopping) return false;
  const newRow = g.playerRow + dr;
  const newCol = g.playerCol + dc;
  if (newCol < 0 || newCol >= LANE_COUNT || newRow < 0) return false;
  if (isBlockedByTree(g, newRow, newCol)) return false;

  g.hopFromRow = g.playerRow;
  g.hopFromCol = g.playerCol;
  g.hopTargetRow = newRow;
  g.hopTargetCol = newCol;
  g.hopT = 0;
  g.hopping = true;
  g.tapCount++;
  g.bopScale = 1.5;
  g.ridingLogId = null;
  return true;
}

export function tryActivateSurge(g: GameRef): boolean {
  if (!g.alive || g.surgeActive || g.surgeCharge < SURGE_MAX) return false;
  g.surgeActive = true;
  g.surgeTimeLeft = SURGE_DURATION_MS;
  g.surgeCharge = 0;
  return true;
}

// ─── Step ─────────────────────────────────────────────────────────────────────

export function stepGame(g: GameRef, dtMs: number): void {
  if (!g.alive) {
    g.deathFlash = Math.max(0, g.deathFlash - dtMs);
    return;
  }

  const sm = g.surgeActive ? SURGE_SLOW : 1.0;

  if (g.surgeActive) {
    g.surgeTimeLeft = Math.max(0, g.surgeTimeLeft - dtMs);
    g.surgeCharge = Math.max(0, g.surgeCharge - SURGE_DRAIN_PER_MS * dtMs);
    if (g.surgeTimeLeft <= 0) { g.surgeActive = false; g.surgeCharge = 0; }
  }

  // Bop decay
  if (g.bopScale !== 1) {
    g.bopScale = g.bopScale > 1
      ? Math.max(1, g.bopScale - dtMs * 0.005)
      : Math.min(1, g.bopScale + dtMs * 0.004);
  }

  // Hop animation
  if (g.hopping) {
    g.hopT = Math.min(1, g.hopT + dtMs / HOP_MS);
    if (g.hopT >= 0.7 && g.bopScale > 0.75) g.bopScale = 0.72;

    if (g.hopT >= 1) {
      g.playerRow = g.hopTargetRow;
      g.playerCol = g.hopTargetCol;
      g.hopping = false;
      g.bopScale = 0.72;

      const row = g.rows.get(g.playerRow);
      if (row?.surgeNodeCol === g.playerCol && !row.surgeCollected) {
        row.surgeCollected = true;
        g.surgeCharge = Math.min(SURGE_MAX, g.surgeCharge + SURGE_NODE_BOOST);
      }
      if (g.playerRow > g.score) {
        g.score = g.playerRow;
        if (!g.surgeActive) g.surgeCharge = Math.min(SURGE_MAX, g.surgeCharge + SURGE_PER_HOP);
      }

      const lr = g.rows.get(g.playerRow);
      if (lr?.kind === 'river') {
        const log = getLogAtPos(g, g.playerRow, g.playerCol);
        if (!log) { kill(g); return; }
        g.ridingLogId = log.id;
      } else if (lr?.kind === 'road' && isHitByCar(g, g.playerRow, g.playerCol)) {
        kill(g); return;
      }
    }
  }

  // Move vehicles
  for (const [, row] of g.rows) {
    if (row.kind === 'road') {
      for (const v of row.vehicles) {
        v.col += v.speed * sm * (dtMs / 1000);
        if (v.speed > 0 && v.col > LANE_COUNT) v.col = -v.width;
        if (v.speed < 0 && v.col + v.width < 0) v.col = LANE_COUNT;
      }
    } else if (row.kind === 'river') {
      for (const l of row.logs) {
        l.col += l.speed * sm * (dtMs / 1000);
        if (l.speed > 0 && l.col > LANE_COUNT + 1) l.col = -l.width;
        if (l.speed < 0 && l.col + l.width < -1) l.col = LANE_COUNT;
      }
    }
  }

  // Carry player with log
  if (!g.hopping && g.ridingLogId !== null) {
    const cr = g.rows.get(g.playerRow);
    if (cr?.kind === 'river') {
      const log = cr.logs.find((l) => l.id === g.ridingLogId);
      if (!log || !covers(log, g.playerCol)) { kill(g); return; }
      g.playerCol = Math.max(0, Math.min(LANE_COUNT - 1, g.playerCol + log.speed * sm * (dtMs / 1000)));
    }
  }

  // Continuous road collision while idle
  if (!g.hopping && isHitByCar(g, g.playerRow, g.playerCol)) { kill(g); return; }

  // Generate ahead
  while (g.maxRow < g.playerRow + ROW_BUFFER) {
    g.maxRow++;
    g.rows.set(g.maxRow, generateRow(g, g.maxRow));
  }

  // Prune behind
  const minKeep = g.playerRow - 12;
  for (const id of g.rows.keys()) if (id < minKeep) g.rows.delete(id);
}

function kill(g: GameRef): void {
  g.alive = false;
  g.deathFlash = 800;
  g.hopping = false;
  g.bopScale = 1;
}

// ─── View helpers ─────────────────────────────────────────────────────────────

function easeOutBack(t: number): number {
  const c = 2.70158;
  return 1 + c * Math.pow(t - 1, 3) + (c - 1) * Math.pow(t - 1, 2);
}

export function getDispPos(g: GameRef): { dispRow: number; dispCol: number } {
  if (!g.hopping || g.hopT >= 1) return { dispRow: g.playerRow, dispCol: g.playerCol };
  const t = easeOutBack(Math.min(1, g.hopT));
  return {
    dispRow: g.hopFromRow + (g.hopTargetRow - g.hopFromRow) * t,
    dispCol: g.hopFromCol + (g.hopTargetCol - g.hopFromCol) * t,
  };
}

/** Vertical arc height in row units during a hop. */
export function getHopArc(g: GameRef): number {
  return g.hopping ? Math.sin(g.hopT * Math.PI) * 0.52 : 0;
}

export { VEHICLE_COLORS };
