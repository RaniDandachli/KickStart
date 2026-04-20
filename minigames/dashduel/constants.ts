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
  /** GD Speed 1 — deliberate and readable. */
  RUN_SPEED: 0.185,
  /** Max speed cap (GD Speed ~3 equivalent). */
  RUN_SPEED_MAX: 0.31,
  /** Speed added per tier. */
  RUN_SPEED_PER_TIER: 0.018,

  ROUND_MS: 0,

  // ── Player ─────────────────────────────────────────────────────────────────
  PLAYER_W: 18,
  PLAYER_H: 18,
  PLAYER_SCREEN_X_RATIO: 0.22,

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
// Each zone = distinct GD level aesthetic.
export const ZONE_THEMES = [
  // Zone 0 — Stereo Madness (stone / warm brown)
  {
    name: 'Stereo Madness',
    sky: '#1a1008',
    skyMid: '#2a1a0c',
    ground: '#3d2b14',
    groundLine: '#c8a05a',
    wallFill: '#5a3e22',
    wallBorder: '#c8a05a',
    wallStripe: 'rgba(255,220,140,0.7)',
    spikeFill0: '#f5c842',
    spikeFill1: '#b8860b',
    spikeStroke: 'rgba(255,240,180,0.9)',
    voidFill: '#0d0804',
    voidLine: 'rgba(220,100,30,0.7)',
    playerFill: '#e8a020',
    playerBorder: '#fff5d0',
    playerGlow: '#e8a020',
    playerInner: '#ffffff',
    gridLine: 'rgba(200,160,90,0.06)',
    ringBorder: 'rgba(255,220,80,0.95)',
    // Parallax bg elements
    bgFar: '#241508',
    bgNear: '#1e1208',
    parallaxColor: 'rgba(100,60,20,0.15)',
  },
  // Zone 1 — Back On Track (green forest / cave)
  {
    name: 'Back On Track',
    sky: '#071a0d',
    skyMid: '#0d2a14',
    ground: '#1a3d22',
    groundLine: '#4caf50',
    wallFill: '#1e5c28',
    wallBorder: '#4caf50',
    wallStripe: 'rgba(160,255,160,0.7)',
    spikeFill0: '#80e860',
    spikeFill1: '#2d7a1a',
    spikeStroke: 'rgba(200,255,180,0.9)',
    voidFill: '#030d05',
    voidLine: 'rgba(60,180,60,0.7)',
    playerFill: '#50d050',
    playerBorder: '#d0ffd0',
    playerGlow: '#50d050',
    playerInner: '#ffffff',
    gridLine: 'rgba(80,200,80,0.06)',
    ringBorder: 'rgba(120,255,100,0.95)',
    bgFar: '#091a0c',
    bgNear: '#071508',
    parallaxColor: 'rgba(40,120,50,0.12)',
  },
  // Zone 2 — Polargeist (purple ice / crystal)
  {
    name: 'Polargeist',
    sky: '#0a0518',
    skyMid: '#120828',
    ground: '#2a1560',
    groundLine: '#a855f7',
    wallFill: '#3b1a7a',
    wallBorder: '#a855f7',
    wallStripe: 'rgba(220,180,255,0.7)',
    spikeFill0: '#d090ff',
    spikeFill1: '#6b21a8',
    spikeStroke: 'rgba(230,200,255,0.9)',
    voidFill: '#040210',
    voidLine: 'rgba(160,80,240,0.7)',
    playerFill: '#c060f0',
    playerBorder: '#f0d0ff',
    playerGlow: '#c060f0',
    playerInner: '#ffffff',
    gridLine: 'rgba(160,80,240,0.06)',
    ringBorder: 'rgba(200,120,255,0.95)',
    bgFar: '#080318',
    bgNear: '#060215',
    parallaxColor: 'rgba(100,40,180,0.12)',
  },
  // Zone 3 — Dry Out (desert / lava)
  {
    name: 'Dry Out',
    sky: '#180800',
    skyMid: '#2a1000',
    ground: '#5a2000',
    groundLine: '#ff6020',
    wallFill: '#7a2e00',
    wallBorder: '#ff6020',
    wallStripe: 'rgba(255,200,120,0.7)',
    spikeFill0: '#ff8040',
    spikeFill1: '#c03000',
    spikeStroke: 'rgba(255,220,180,0.9)',
    voidFill: '#0d0400',
    voidLine: 'rgba(240,80,20,0.7)',
    playerFill: '#ff5520',
    playerBorder: '#ffe0cc',
    playerGlow: '#ff5520',
    playerInner: '#ffffff',
    gridLine: 'rgba(240,120,40,0.06)',
    ringBorder: 'rgba(255,160,60,0.95)',
    bgFar: '#180600',
    bgNear: '#120400',
    parallaxColor: 'rgba(180,60,10,0.12)',
  },
] as const;

export type ZoneTheme = typeof ZONE_THEMES[number];

export function getZoneTheme(tier: number): ZoneTheme {
  const idx = Math.min(Math.floor(tier / 2), ZONE_THEMES.length - 1);
  return ZONE_THEMES[idx];
}