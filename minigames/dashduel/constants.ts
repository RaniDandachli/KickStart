/** Logical playfield — scaled to device width in UI. */
export const DD = {
  PLAY_W: 360,
  PLAY_H: 200,
  GROUND_Y: 168,
  PLAYER_W: 14,
  PLAYER_H: 14,
  PLAYER_OFFSET_X: 68,
  /** Snappier arc (Geometry Dash–style: fast fall, crisp jump). */
  GRAVITY: 0.00118,
  JUMP_VY: -0.5,
  MAX_FALL: 1.05,
  /** Scroll units per ms at start — ramps up. */
  BASE_SCROLL_PER_MS: 0.108,
  SCROLL_RAMP_PER_MS2: 0.000000095,
  MAX_SCROLL_PER_MS: 0.28,
  /** Late tap still registers shortly after landing (ms). */
  JUMP_BUFFER_MS: 140,
  /** Round cap — if both alive, higher distance wins. */
  ROUND_MS: 90_000,
  /** Course length in world units (enough for long runs). */
  COURSE_LENGTH: 120_000,
  /** Death if below this Y (center). */
  FALL_DEATH_Y: 210,
  /** Shrink spike/ceiling AABB so hits match visuals a bit better. */
  HAZARD_HIT_INSET: 2,
} as const;

export function playerFootY(centerY: number): number {
  return centerY + DD.PLAYER_H / 2;
}

export function playerHeadY(centerY: number): number {
  return centerY - DD.PLAYER_H / 2;
}

export function playerX(scroll: number): number {
  return scroll + DD.PLAYER_OFFSET_X;
}
