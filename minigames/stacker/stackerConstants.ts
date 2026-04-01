/** Discrete grid columns — base pad is 3 units wide, centered. */
export const STACKER_GRID_COLS = 9;
/** Fixed base (major tier): 3 blocks wide. */
export const STACKER_BASE = { left: 3, width: 3 } as const;
/**
 * Successful stacks needed for jackpot (not counting the base pad).
 * High count + speed ramp — tuned so casual first-try jackpots are rare.
 */
export const STACKER_WIN_ROWS = 26;
/** Horizontal speed: grid units per second (1 unit = one column width). */
export const STACKER_SPEED_START = 6.2;
export const STACKER_SPEED_MULT = 1.078;
export const STACKER_SPEED_MAX = 24;
/** From this placed-row onward, apply an extra multiplier each stack (jackpot climb). */
export const STACKER_LATE_ROW_START = 12;
export const STACKER_LATE_MULT = 1.055;
