// ─── NEON RUNNER — Constants ───────────────────────────────────────────────
// GD-calibrated physics. All values tuned for 16ms substeps at 60fps.

export const NR = {
  // ── Canvas ─────────────────────────────────────────────────────────────────
  /** Wider than tall — forced landscape. */
  PLAY_W: 480,
  PLAY_H: 160,

  GROUND_H: 32,
  TILE: 24,

  // ── Physics ────────────────────────────────────────────────────────────────
  /**
   * GD gravity is punishingly fast. Per 16ms substep.
   * Real GD is ~0.28; this is tuned for the jump arc below.
   */
  GRAVITY: 0.32,
  /**
   * Jump velocity. Clears 2T stair columns (48px) + single spikes.
   * Arc height ≈ vy²/(2*g) = 5.6²/(2*0.32) ≈ 49px — hits just above 2T.
   * Feels snappy at Speed 1; not floaty.
   */
  JUMP_V: -5.6,
  MAX_FALL_VY: 14,
  /** Tap slightly early, fire immediately. */
  JUMP_BUFFER_MS: 120,
  /** True GD has 0 coyote; keep 0 for authenticity. */
  COYOTE_MS: 0,

  // ── Speed ──────────────────────────────────────────────────────────────────
  /**
   * GD Speed 1 (Stereo Madness default) = ~0.185 world-px/ms.
   * Feels deliberate and readable — patterns have breathing room.
   */
  RUN_SPEED: 0.185,

  ROUND_MS: 0,

  // ── Player ─────────────────────────────────────────────────────────────────
  /** GD icon is a square. 18px feels right at this resolution. */
  PLAYER_W: 18,
  PLAYER_H: 18,

  /** Player positioned at ~22% of screen width (GD: ~30%). */
  PLAYER_SCREEN_X_RATIO: 0.22,

  // ── Generation ─────────────────────────────────────────────────────────────
  MIN_GAP_BETWEEN_OBSTACLES: 40,
  LOOKAHEAD_TILES: 30,

  DIST_SCALE: 0.4,
} as const;

export const GROUND_Y = NR.PLAY_H - NR.GROUND_H;