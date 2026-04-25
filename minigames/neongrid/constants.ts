/** Number of parallel lanes (three-lane street runner layout). */
export const LANE_COUNT = 3;

/** Rows buffered ahead of player. */
export const ROW_BUFFER = 20;

/** First N rows always safe. */
export const SAFE_ZONE_ROWS = 4;

/** Player starts center column. */
export const START_COL = Math.floor(LANE_COUNT / 2);

/** Hop animation duration (ms). */
export const HOP_MS = 140;

/** Probability a row is safe grass. */
export const SAFE_ROW_CHANCE = 0.22;

/** Probability a hazard row is a river. */
export const RIVER_ROW_CHANCE = 0.26;

/** Probability each cell on a safe row has a tree/obstacle (lower for narrow sidewalks). */
export const TREE_CHANCE = 0.11;

/** Vehicle speed parameters. */
export const SPEED_BASE = 1.2;
export const SPEED_ROW_SCALE = 0.025;
export const SPEED_RAND = 0.5;
export const SPEED_MAX = 5.5;

/** Log speed parameters. */
export const LOG_SPEED_BASE = 0.65;
export const LOG_SPEED_RAND = 0.4;
export const LOG_SPEED_MAX = 2.6;

/** Log width range (lane units). */
export const LOG_MIN_WIDTH = 2;
export const LOG_MAX_WIDTH = 3;

// ── Spirit power mechanic ─────────────────────────────────────────────────────
export const SURGE_MAX = 100;
export const SURGE_PER_HOP = 18;
export const SURGE_NODE_BOOST = 45;
export const SURGE_NODE_CHANCE = 0.20;
export const SURGE_DURATION_MS = 3200;
export const SURGE_SLOW = 0.13;
export const SURGE_DRAIN_PER_MS = 100 / SURGE_DURATION_MS;

// ── Cartoon vehicle colors ────────────────────────────────────────────────────
export const VEHICLE_COLORS = [
  { body: '#E8453C', roof: '#C0392B' },
  { body: '#F0A500', roof: '#D4920A' },
  { body: '#27AE60', roof: '#1E8449' },
  { body: '#2980B9', roof: '#1F6FA5' },
  { body: '#8E44AD', roof: '#7D3C98' },
] as const;

// ── World palette — cyberpunk night street ───────────────────────────────────
export const COLORS = {
  skyTop:           '#06040c',
  skyBottom:        '#0c0820',
  grassA:           '#1e1a24',
  grassB:           '#252030',
  grassBorder:      '#12101a',
  roadA:            '#1a1822',
  roadB:            '#14121c',
  roadBorder:       '#0a0810',
  roadLine:         'rgba(255,220,100,0.35)',
  riverA:           '#0f1a32',
  riverB:           '#121f3d',
  riverBorder:      '#080f22',
  logTop:           '#6B4E2E',
  logSide:          '#3d2a18',
  logHighlight:     'rgba(200,160,60,0.22)',
  treeCanopy:       '#2a2438',
  treeShade:        '#1a1624',
  treeHighlight:    '#3d3550',
  treeTrunk:        '#3a3248',
  scooterBody:      '#2563EB',
  scooterSide:      '#1e3a8a',
  scooterSurge:     '#E11D48',
  scooterSurgeSide: '#881337',
  helmetNorm:       '#DC2626',
  helmetSurge:      '#FBBF24',
  skinTone:         '#FECDD3',
  wheelDark:        '#0f0f12',
  wheelHub:         '#3f3f46',
  spiritGold:       '#FACC15',
  spiritGlow:       '#A855F7',
  hudGold:          '#FDE047',
  hudGoldDim:       'rgba(253,224,71,0.7)',
  hudMuted:         'rgba(196,181,253,0.75)',
  surgeOrange:      '#F97316',
  neonPurple:       '#9333EA',
  neonPurpleDim:    '#6B21A8',
  metalPanel:       '#12101c',
  metalEdge:        '#4c1d95',
  goldBoost:        '#FFD700',
} as const;