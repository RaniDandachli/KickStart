/** World scroll speed (px/s) — forward flight feel. */
export const FORWARD_PX_S = 220;
/** Gravity (px/s²) downward — reduced for floatier feel. */
export const GRAVITY_PX_S2 = 520;
/** Thrust while holding (px/s²) upward. */
export const THRUST_PX_S2 = 1020;
/** Max downward / upward speed (px/s). */
export const MAX_VY = 400;
export const SHIP_W = 30;
export const SHIP_H = 24;
/** Ship world X = scroll + this offset (keeps ship fixed on screen). */
export const SHIP_X_OFFSET = 140;
/** Segment width range (world px). */
export const SEG_W_MIN = 130;
export const SEG_W_MAX = 220;
/** Vertical gap for the ship (px). */
export const GAP_H_MIN = 115;
export const GAP_H_MAX = 170;
/** Minimum corridor margin from top/bottom so gaps stay playable. */
export const MARGIN = 50;

/** Spike dimensions. */
export const SPIKE_HW = 9;
export const SPIKE_H = 16;
/** Minimum world-px gap between consecutive spikes. */
export const SPIKE_SPACING_MIN = 130;
export const SPIKE_SPACING_MAX = 280;

export const COLORS = {
  skyTop: '#1a0a2e',
  skyBot: '#0f0220',
  block: '#3b0764',
  blockEdge: '#e879f9',
  shipFill: '#FFD700',
  shipStroke: '#FFE082',
  spike: '#f472b6',
  spikeStroke: 'rgba(244,114,182,0.65)',
  hud: '#f5e6c0',
  hudMuted: 'rgba(200,180,220,0.65)',
} as const;