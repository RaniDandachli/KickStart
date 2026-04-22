/** Number of parallel lanes (Crossy-style grid width). */
export const LANE_COUNT = 7;

/** Rows generated ahead of player at all times. */
export const ROW_BUFFER = 16;

/** First N rows are always safe (starting zone). */
export const SAFE_ZONE_ROWS = 5;

/** Player starts in the middle column. */
export const START_COL = Math.floor(LANE_COUNT / 2);

/** Hop animation duration (ms). */
export const HOP_MS = 145;

/** Probability a row is traffic-free ("safe" rest row). */
export const SAFE_ROW_CHANCE = 0.20;

/** Base vehicle speed (lanes/sec) — scales with score. */
export const SPEED_BASE = 1.3;
export const SPEED_ROW_SCALE = 0.028;
export const SPEED_RAND = 0.55;
export const SPEED_MAX = 6.0;

/** Neon vehicle colors (cycled per row). */
export const VEHICLE_COLORS = [
  '#22D3EE', // cyan
  '#E879F9', // magenta
  '#FB923C', // orange
  '#A3E635', // lime
  '#F472B6', // pink
] as const;

// ── SURGE power mechanic ─────────────────────────────────────────────────────

/** Meter fills via forward hops + node pickups; activate at 100. */
export const SURGE_MAX = 100;
/** Meter gain per forward hop. */
export const SURGE_PER_HOP = 20;
/** Extra boost from collecting a ⚡ node. */
export const SURGE_NODE_BOOST = 48;
/** Chance a row has a surge node. */
export const SURGE_NODE_CHANCE = 0.26;

/** Active surge duration (ms). */
export const SURGE_DURATION_MS = 3500;
/** Traffic speed multiplier while surge is active. */
export const SURGE_SLOW = 0.11;
/** Drain rate (meter units / ms) while surge is active. */
export const SURGE_DRAIN_PER_MS = 100 / SURGE_DURATION_MS;
