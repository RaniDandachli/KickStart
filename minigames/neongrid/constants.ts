/** Number of parallel lanes (Crossy-style grid width). */
export const LANE_COUNT = 7;

/** Rows generated ahead of player at all times. */
export const ROW_BUFFER = 18;

/** First N rows are always safe (starting zone). */
export const SAFE_ZONE_ROWS = 4;

/** Player starts in the middle column. */
export const START_COL = Math.floor(LANE_COUNT / 2);

/** Hop animation duration (ms) — snappier than before. */
export const HOP_MS = 130;

/** Probability a row is a safe grass row. */
export const SAFE_ROW_CHANCE = 0.22;

/** Probability a traffic row is actually a river row. */
export const RIVER_ROW_CHANCE = 0.28;

/** Base vehicle speed (lanes/sec). */
export const SPEED_BASE = 1.2;
export const SPEED_ROW_SCALE = 0.025;
export const SPEED_RAND = 0.5;
export const SPEED_MAX = 5.5;

/** Log speed on river rows (lanes/sec) — slower than cars. */
export const LOG_SPEED_BASE = 0.6;
export const LOG_SPEED_RAND = 0.4;
export const LOG_SPEED_MAX = 2.8;

/** Log width range (in lane units). */
export const LOG_MIN_WIDTH = 2;
export const LOG_MAX_WIDTH = 3;

/** Car colors — warm, earthy palette. */
export const VEHICLE_COLORS = [
  '#FF6B35', // sunset orange
  '#FFB347', // amber
  '#FF4757', // coral red
  '#FFC300', // golden yellow
  '#FF8C69', // salmon
] as const;

/** Log / raft color. */
export const LOG_COLOR = '#8B6914';
export const LOG_HIGHLIGHT = '#C49A2A';

// ── SURGE / SPIRIT power mechanic ────────────────────────────────────────────

export const SURGE_MAX = 100;
export const SURGE_PER_HOP = 18;
export const SURGE_NODE_BOOST = 45;
export const SURGE_NODE_CHANCE = 0.22;
export const SURGE_DURATION_MS = 3200;
export const SURGE_SLOW = 0.12;
export const SURGE_DRAIN_PER_MS = 100 / SURGE_DURATION_MS;

// ── Obstacle (trees) on safe rows ────────────────────────────────────────────

/** Probability each cell on a safe row has a tree (blocks movement). */
export const TREE_CHANCE = 0.18;

// ── Visual / world palette ────────────────────────────────────────────────────

export const COLORS = {
  sky: '#0F172A',          // deep indigo sky
  grassDark: '#1A3A1A',    // deep forest floor
  grassLight: '#1F4A1F',   // lighter grass stripe
  roadDark: '#1C1410',     // dark asphalt
  roadLight: '#221A12',    // road stripe
  riverDeep: '#0A2540',    // deep water
  riverShallow: '#0D3358', // shallow water shimmer
  safeStroke: '#2D6A2D',   // grass border
  roadStroke: '#3D2B1A',   // road border
  riverStroke: '#0A4080',  // river border
  playerGlow: '#FFD700',   // spirit fox gold
  playerCore: '#FFF5CC',   // inner light
  surgeGlow: '#FF6B35',    // surge orange
  spiritOrb: '#FFE066',    // spirit energy node
} as const;