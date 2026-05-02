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
  GRAVITY: 0.32,
  /**
   * Jump velocity. Clears 2T stair columns (48px) + single spikes.
   * Arc height ≈ vy²/(2*g) = 5.6²/(2*0.32) ≈ 49px — hits just above 2T.
   */
  JUMP_V: -5.6,
  MAX_FALL_VY: 14,
  JUMP_BUFFER_MS: 120,
  COYOTE_MS: 0,

  // ── Speed ──────────────────────────────────────────────────────────────────
  /** GD Speed 1 — deliberate and readable. Difficulty comes from pattern density, not speed. */
  RUN_SPEED: 0.185,
  /** Speed is kept constant — no ramp. */
  RUN_SPEED_MAX: 0.185,
  /** No speed increase per tier — patterns do the work. */
  RUN_SPEED_PER_TIER: 0,

  ROUND_MS: 0,

  // ── Player ─────────────────────────────────────────────────────────────────
  PLAYER_W: 18,
  PLAYER_H: 18,
  PLAYER_SCREEN_X_RATIO: 0.22,
  /**
   * Horizontal view multiplier (>1 = zoom out — see more track ahead for reactions).
   * Physics stay in base PLAY_W space; only rendering/camera widen ~8%.
   */
  CAMERA_VIEW_WIDTH_MULT: 1.08,

  // ── Generation ─────────────────────────────────────────────────────────────
  MIN_GAP_BETWEEN_OBSTACLES: 40,
  LOOKAHEAD_TILES: 30,

  DIST_SCALE: 0.4,

  // ── Tiers ─────────────────────────────────────────────────────────────────
  /** px scrolled per tier step. */
  SCROLL_PER_TIER: 680,
  MAX_TIER: 8,
} as const;

export const GROUND_Y = NR.PLAY_H - NR.GROUND_H;

// ─── GD Level Zone themes — one per 2 tiers ───────────────────────────────
// Original zone names. Palettes pulled directly from GD level screenshots.
// All backgrounds are deep + saturated; blocks dark with bright glowing borders.
export const ZONE_THEMES = [
  // Zone 0 — "Circuit Rush" — GD Stereo Madness: dark blue/grey, white glow blocks
  {
    name: 'Circuit Rush',
    // Sky: dark navy, same as GD default
    sky: '#1a1f2e',
    skyMid: '#1e2438',
    // Background rect layers (the GD wallpaper squares)
    bgRect0: 'rgba(255,255,255,0.04)',  // far layer
    bgRect1: 'rgba(255,255,255,0.07)',  // mid layer
    bgRect2: 'rgba(255,255,255,0.10)',  // near layer
    // Ground
    ground: '#0e1520',
    groundLine: '#ffffff',
    groundGrid: 'rgba(255,255,255,0.18)',
    // Walls — dark interior, bright white glow border
    wallFill: '#0d1a2e',
    wallBorder: '#ffffff',
    wallGrid: 'rgba(255,255,255,0.15)',
    wallStripe: 'rgba(255,255,255,0.85)',
    // Spikes — GD white/light-glow triangles
    spikeFill0: '#c8d8ff',
    spikeFill1: '#4060c0',
    spikeStroke: 'rgba(255,255,255,0.95)',
    // Void
    voidFill: '#05080f',
    voidLine: 'rgba(255,255,255,0.5)',
    // Player — classic GD green icon
    playerOuter: '#39e600',
    playerMid: '#1a9900',
    playerInner: '#FFD700',
    playerGlow: '#39e600',
    playerBorder: '#ffffff',
    // Grid overlay on sky
    gridLine: 'rgba(255,255,255,0.04)',
    // Orb
    ringBorder: '#ffffff',
    ringFill: 'transparent',
    // Floating diamond decorations
    diamondColor: 'rgba(255,255,255,0.12)',
    // Hint text
    accentColor: '#ffffff',
  },
  // Zone 1 — "Void Garden" — GD Back On Track / Polargeist: rich purple
  {
    name: 'Void Garden',
    sky: '#3a0d6e',
    skyMid: '#4a1280',
    bgRect0: 'rgba(180,80,255,0.06)',
    bgRect1: 'rgba(180,80,255,0.10)',
    bgRect2: 'rgba(180,80,255,0.14)',
    ground: '#1e0840',
    groundLine: '#e066ff',
    groundGrid: 'rgba(220,100,255,0.22)',
    wallFill: '#1a0535',
    wallBorder: '#e066ff',
    wallGrid: 'rgba(220,100,255,0.18)',
    wallStripe: 'rgba(240,160,255,0.85)',
    spikeFill0: '#ff80ff',
    spikeFill1: '#7700bb',
    spikeStroke: 'rgba(255,200,255,0.95)',
    voidFill: '#0a0018',
    voidLine: 'rgba(200,80,255,0.6)',
    playerOuter: '#39e600',
    playerMid: '#1a9900',
    playerInner: '#FFD700',
    playerGlow: '#39e600',
    playerBorder: '#ffffff',
    gridLine: 'rgba(180,80,255,0.05)',
    ringBorder: '#ffffff',
    ringFill: 'transparent',
    diamondColor: 'rgba(200,120,255,0.18)',
    accentColor: '#e066ff',
  },
  // Zone 2 — "Neon Abyss" — GD Polargeist deep: very deep purple/indigo with bright accents
  {
    name: 'Neon Abyss',
    sky: '#1a0d3d',
    skyMid: '#220f50',
    bgRect0: 'rgba(100,60,255,0.07)',
    bgRect1: 'rgba(100,60,255,0.11)',
    bgRect2: 'rgba(100,60,255,0.16)',
    ground: '#0d0628',
    groundLine: '#8855ff',
    groundGrid: 'rgba(140,80,255,0.22)',
    wallFill: '#120820',
    wallBorder: '#9966ff',
    wallGrid: 'rgba(140,80,255,0.18)',
    wallStripe: 'rgba(180,140,255,0.85)',
    spikeFill0: '#cc99ff',
    spikeFill1: '#4422aa',
    spikeStroke: 'rgba(210,180,255,0.95)',
    voidFill: '#050210',
    voidLine: 'rgba(120,60,255,0.6)',
    playerOuter: '#39e600',
    playerMid: '#1a9900',
    playerInner: '#FFD700',
    playerGlow: '#39e600',
    playerBorder: '#ffffff',
    gridLine: 'rgba(100,60,255,0.05)',
    ringBorder: '#ffffff',
    ringFill: 'transparent',
    diamondColor: 'rgba(140,100,255,0.2)',
    accentColor: '#9966ff',
  },
  // Zone 3 — "Pulse Inferno" — hot purple + brand gold (no teal/cyan)
  {
    name: 'Pulse Inferno',
    sky: '#1a0d28',
    skyMid: '#2d1240',
    bgRect0: 'rgba(255,215,0,0.06)',
    bgRect1: 'rgba(168,85,247,0.10)',
    bgRect2: 'rgba(255,200,0,0.10)',
    ground: '#0c0614',
    groundLine: '#FFD700',
    groundGrid: 'rgba(255,200,0,0.22)',
    wallFill: '#12081c',
    wallBorder: '#e8b000',
    wallGrid: 'rgba(200,150,0,0.2)',
    wallStripe: 'rgba(255,220,120,0.85)',
    spikeFill0: '#ffe066',
    spikeFill1: '#6d28d9',
    spikeStroke: 'rgba(255,240,200,0.95)',
    voidFill: '#050208',
    voidLine: 'rgba(168,85,247,0.5)',
    playerOuter: '#39e600',
    playerMid: '#1a9900',
    playerInner: '#FFD700',
    playerGlow: '#39e600',
    playerBorder: '#ffffff',
    gridLine: 'rgba(100,60,255,0.05)',
    ringBorder: '#ffffff',
    ringFill: 'transparent',
    diamondColor: 'rgba(255,200,0,0.2)',
    accentColor: '#FFD700',
  },
] as const;

export type ZoneTheme = typeof ZONE_THEMES[number];

export function getZoneTheme(tier: number): ZoneTheme {
  const idx = Math.min(Math.floor(tier / 2), ZONE_THEMES.length - 1);
  return ZONE_THEMES[idx];
}