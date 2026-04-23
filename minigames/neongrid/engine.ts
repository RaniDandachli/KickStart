import {
  HOP_MS,
  LANE_COUNT,
  LOG_COLOR,
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
  width: number;
  speed: number;
  colorIdx: number;
};

export type Log = {
  id: number;
  col: number;
  width: number;  // in lane units
  speed: number;  // positive = right, negative = left
};

export type RowKind = 'safe' | 'road' | 'river';

export type GridRow = {
  rowId: number;
  kind: RowKind;
  vehicles: Vehicle[];  // road only
  logs: Log[];          // river only
  treeMask: readonly boolean[]; // safe only — true = tree blocks movement
  surgeNodeCol: number | null;
  surgeCollected: boolean;
};

export type GameRef = {
  rows: Map<number, GridRow>;
  maxRow: number;

  playerRow: number;
  playerCol: number;

  // Riding a log: tracks which log the player is on
  ridingLogId: number | null;

  // hop animation
  hopping: boolean;
  hopFromRow: number;
  hopFromCol: number;
  hopTargetRow: number;
  hopTargetCol: number;
  hopT: number;

  // squash/stretch animation (0=flat, 1=normal, >1=stretch)
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
    // Never block the center start column so player can always escape
    mask.push(i !== START_COL && rng() < TREE_CHANCE);
  }
  // Guarantee at least one open lane
  if (mask.every(Boolean)) mask[START_COL] = false;
  return mask;
}

function generateRow(g: GameRef, rowId: number): GridRow {
  const rng = g.rng;

  // Safe start zone
  if (rowId < SAFE_ZONE_ROWS) {
    const surgeNodeCol = rowId > 0 && rng() < SURGE_NODE_CHANCE
      ? Math.floor(rng() * LANE_COUNT) : null;
    return {
      rowId,
      kind: 'safe',
      vehicles: [],
      logs: [],
      treeMask: Array(LANE_COUNT).fill(false),
      surgeNodeCol,
      surgeCollected: false,
    };
  }

  const roll = rng();
  let kind: RowKind;
  if (roll < SAFE_ROW_CHANCE) {
    kind = 'safe';
  } else if (roll < SAFE_ROW_CHANCE + RIVER_ROW_CHANCE) {
    kind = 'river';
  } else {
    kind = 'road';
  }

  const surgeNodeCol = rng() < SURGE_NODE_CHANCE ? Math.floor(rng() * LANE_COUNT) : null;

  if (kind === 'safe') {
    return {
      rowId,
      kind: 'safe',
      vehicles: [],
      logs: [],
      treeMask: buildTreeMask(rng),
      surgeNodeCol,
      surgeCollected: false,
    };
  }

  if (kind === 'river') {
    // Generate logs
    const dir = rng() < 0.5 ? 1 : -1;
    const speed = dir * Math.min(
      LOG_SPEED_MAX,
      LOG_SPEED_BASE + rng() * LOG_SPEED_RAND,
    );
    const logs: Log[] = [];
    let cursor = rng() * 1.5;
    const numLogs = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < numLogs; i++) {
      const w = LOG_MIN_WIDTH + Math.floor(rng() * (LOG_MAX_WIDTH - LOG_MIN_WIDTH + 1));
      if (cursor + w > LANE_COUNT + 6) break;
      const col = dir > 0 ? cursor : LANE_COUNT - cursor - w;
      logs.push({ id: g.nextId++, col, width: w, speed });
      cursor += w + 1.2 + rng() * 2.2;
    }
    return { rowId, kind: 'river', vehicles: [], logs, treeMask: [], surgeNodeCol, surgeCollected: false };
  }

  // Road row
  const difficulty = Math.min(1, rowId / 60);
  const baseSpeed = Math.min(
    SPEED_MAX,
    SPEED_BASE + SPEED_ROW_SCALE * rowId + rng() * SPEED_RAND,
  );
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
      id: g.nextId++,
      col,
      width,
      speed: dir * baseSpeed * (0.88 + rng() * 0.24),
      colorIdx,
    });
    cursor += width + 0.8 + rng() * 2.0;
  }

  return { rowId, kind: 'road', vehicles, logs: [], treeMask: [], surgeNodeCol, surgeCollected: false };
}

// ─── Construction ─────────────────────────────────────────────────────────────

export function createGameRef(seed: number): GameRef {
  const g: GameRef = {
    rows: new Map(),
    maxRow: 0,
    playerRow: 0,
    playerCol: START_COL,
    ridingLogId: null,
    hopping: false,
    hopFromRow: 0,
    hopFromCol: START_COL,
    hopTargetRow: 0,
    hopTargetCol: START_COL,
    hopT: 1,
    bopScale: 1,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vehicleCoversCol(v: Vehicle | Log, col: number): boolean {
  const center = col + 0.5;
  return v.col < center && v.col + v.width > center;
}

/** Returns the log at this position, or null. */
function getLogAtPos(g: GameRef, row: number, col: number): Log | null {
  const r = g.rows.get(row);
  if (!r || r.kind !== 'river') return null;
  return r.logs.find((l) => vehicleCoversCol(l, col)) ?? null;
}

function isBlockedByTree(g: GameRef, row: number, col: number): boolean {
  const r = g.rows.get(row);
  if (!r || r.kind !== 'safe') return false;
  return r.treeMask[col] === true;
}

function isHitByCar(g: GameRef, row: number, col: number): boolean {
  const r = g.rows.get(row);
  if (!r || r.kind !== 'road') return false;
  return r.vehicles.some((v) => vehicleCoversCol(v, col));
}

// ─── Input ────────────────────────────────────────────────────────────────────

export function tryHop(g: GameRef, dr: number, dc: number): boolean {
  if (!g.alive || g.hopping) return false;
  const newRow = g.playerRow + dr;
  const newCol = g.playerCol + dc;
  if (newCol < 0 || newCol >= LANE_COUNT) return false;
  if (newRow < 0) return false;

  // Can't hop into a tree
  if (dr !== 0 || dc !== 0) {
    if (isBlockedByTree(g, newRow, newCol)) return false;
  }

  g.hopFromRow = g.playerRow;
  g.hopFromCol = g.playerCol;
  g.hopTargetRow = newRow;
  g.hopTargetCol = newCol;
  g.hopT = 0;
  g.hopping = true;
  g.tapCount += 1;
  g.bopScale = 1.5; // stretch on jump start
  g.ridingLogId = null; // detach from log while hopping
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

  // Bop scale decay back to 1
  if (g.bopScale !== 1) {
    g.bopScale = g.bopScale > 1
      ? Math.max(1, g.bopScale - dtMs * 0.004)
      : Math.min(1, g.bopScale + dtMs * 0.003);
  }

  // Hop animation
  if (g.hopping) {
    g.hopT = Math.min(1, g.hopT + dtMs / HOP_MS);

    // Squash on land
    if (g.hopT >= 0.7 && g.bopScale > 0.75) {
      g.bopScale = 0.72;
    }

    if (g.hopT >= 1) {
      g.playerRow = g.hopTargetRow;
      g.playerCol = g.hopTargetCol;
      g.hopping = false;
      g.bopScale = 0.72; // squash on land

      // Collect surge node
      const row = g.rows.get(g.playerRow);
      if (row?.surgeNodeCol === g.playerCol && !row.surgeCollected) {
        row.surgeCollected = true;
        g.surgeCharge = Math.min(SURGE_MAX, g.surgeCharge + SURGE_NODE_BOOST);
      }

      // Forward hop score
      if (g.playerRow > g.score) {
        g.score = g.playerRow;
        if (!g.surgeActive) {
          g.surgeCharge = Math.min(SURGE_MAX, g.surgeCharge + SURGE_PER_HOP);
        }
      }

      // Landing checks
      const landRow = g.rows.get(g.playerRow);

      if (landRow?.kind === 'river') {
        const log = getLogAtPos(g, g.playerRow, g.playerCol);
        if (!log) {
          kill(g);
          return;
        }
        g.ridingLogId = log.id;
      } else if (landRow?.kind === 'road') {
        if (isHitByCar(g, g.playerRow, g.playerCol)) {
          kill(g);
          return;
        }
      }
    }
  }

  // Move vehicles
  for (const [, row] of g.rows) {
    if (row.kind === 'road') {
      for (const v of row.vehicles) {
        v.col += v.speed * speedMul * (dtMs / 1000);
        if (v.speed > 0 && v.col > LANE_COUNT) v.col = -v.width;
        if (v.speed < 0 && v.col + v.width < 0) v.col = LANE_COUNT;
      }
    } else if (row.kind === 'river') {
      for (const l of row.logs) {
        l.col += l.speed * speedMul * (dtMs / 1000);
        if (l.speed > 0 && l.col > LANE_COUNT + 1) l.col = -l.width;
        if (l.speed < 0 && l.col + l.width < -1) l.col = LANE_COUNT;
      }
    }
  }

  // Carry player with log
  if (!g.hopping && g.ridingLogId !== null) {
    const currentRow = g.rows.get(g.playerRow);
    if (currentRow?.kind === 'river') {
      const log = currentRow.logs.find((l) => l.id === g.ridingLogId);
      if (log) {
        // Nudge player col by log delta (approximate — we track log position)
        const logCenter = log.col + log.width / 2;
        // Just check if still on log
        if (!vehicleCoversCol(log, g.playerCol)) {
          // Player drifted off log edge
          kill(g);
          return;
        }
        // Drift player with log (by speed)
        g.playerCol = Math.max(0, Math.min(LANE_COUNT - 1,
          g.playerCol + log.speed * speedMul * (dtMs / 1000),
        ));
        // Kill if drifted off screen
        if (g.playerCol <= 0 && log.speed < 0) {
          kill(g);
          return;
        }
        if (g.playerCol >= LANE_COUNT - 1 && log.speed > 0) {
          kill(g);
          return;
        }
      } else {
        // Log gone
        kill(g);
        return;
      }
    }
  }

  // Continuous collision on road while idle
  if (!g.hopping) {
    if (isHitByCar(g, g.playerRow, g.playerCol)) {
      kill(g);
      return;
    }
  }

  // Generate rows ahead
  while (g.maxRow < g.playerRow + ROW_BUFFER) {
    g.maxRow++;
    g.rows.set(g.maxRow, generateRow(g, g.maxRow));
  }

  // Prune old rows
  const minKeep = g.playerRow - 10;
  for (const id of g.rows.keys()) {
    if (id < minKeep) g.rows.delete(id);
  }
}

function kill(g: GameRef): void {
  g.alive = false;
  g.deathFlash = 800;
  g.hopping = false;
  g.bopScale = 1;
}

// ─── View helpers ─────────────────────────────────────────────────────────────

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function getDispPos(g: GameRef): { dispRow: number; dispCol: number } {
  if (!g.hopping || g.hopT >= 1) {
    return { dispRow: g.playerRow, dispCol: g.playerCol };
  }
  const t = easeOutBack(Math.min(1, g.hopT));
  return {
    dispRow: g.hopFromRow + (g.hopTargetRow - g.hopFromRow) * t,
    dispCol: g.hopFromCol + (g.hopTargetCol - g.hopFromCol) * t,
  };
}

/** Arc height in row units for the hop bounce. */
export function getHopArc(g: GameRef): number {
  if (!g.hopping) return 0;
  return Math.sin(g.hopT * Math.PI) * 0.55;
}

export { LOG_COLOR, VEHICLE_COLORS };
