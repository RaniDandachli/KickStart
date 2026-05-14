/**
 * Run It Arcade — **purple** + **gold** accents on **neutral charcoal** shells (reference: deep grey
 * backgrounds, slightly lighter cards). Surfaces stay grey; purple / gold are accents only.
 */
export const runit = {
  /** Hot accent — orchid / fuchsia (pairs with purple CTAs). */
  neonPink: '#E879F9',
  /** Gold highlight (legacy name `neonCyan` — was turquoise; now brand gold / pale gold). */
  neonCyan: '#FFD700',
  /** Primary brand purple — neon tube, borders, key UI. */
  neonPurple: '#A855F7',
  /** Deeper jewel violet — crowns, dark fills. */
  purpleDeep: '#6B21A8',
  /** Primary brand gold (replaces all turquoise in shell UI). */
  gold: '#FFD700',
  goldBright: '#FFEB3B',
  /** Pale gold for soft fills / text on dark. */
  goldSoft: '#FFF3B0',
  /** App shell — deep charcoal (~Skillz-style base). */
  bgDeep: '#121214',
  /** Cards / panels — elevated grey. */
  bgPanel: 'rgba(24, 24, 27, 0.96)',
  glass: 'rgba(24, 24, 27, 0.82)',
  /** Secondary labels on dark UI. */
  textSecondary: '#8E8E93',
} as const;

/**
 * Modal / card scrims — same hue family as `bgDeep` / `bgPanel`, no violet cast.
 * Prefer these over ad-hoc `rgba(6,2,14,…)` so the app stays one neutral secondary ramp.
 */
export const runitShell = {
  scrim96: 'rgba(18, 18, 20, 0.96)',
  scrim94: 'rgba(18, 18, 20, 0.94)',
  scrim92: 'rgba(18, 18, 20, 0.92)',
  scrim90: 'rgba(18, 18, 20, 0.90)',
  scrim88: 'rgba(18, 18, 20, 0.88)',
  scrim85: 'rgba(18, 18, 20, 0.85)',
  scrim82: 'rgba(18, 18, 20, 0.82)',
  scrim80: 'rgba(18, 18, 20, 0.80)',
  scrim72: 'rgba(18, 18, 20, 0.72)',
  scrim70: 'rgba(18, 18, 20, 0.70)',
  scrim60: 'rgba(18, 18, 20, 0.60)',
  scrim55: 'rgba(18, 18, 20, 0.55)',
  card98: 'rgba(24, 24, 27, 0.98)',
  card90: 'rgba(24, 24, 27, 0.90)',
  card88: 'rgba(24, 24, 27, 0.88)',
  card85: 'rgba(24, 24, 27, 0.85)',
} as const;

/** Full-screen vertical gradient — neutral charcoal steps (no purple in the base wash). */
export const APP_SCREEN_GRADIENT_COLORS = ['#0B0B0D', '#121214', '#161618', '#101012'] as const;

export const APP_SCREEN_GRADIENT_LOCATIONS = [0, 0.32, 0.65, 1] as const;

/** Section dividers & tab chrome — soft neutral rim (purple reserved for CTAs / focus). */
export const appChromeLinePink = 'rgba(255, 255, 255, 0.06)';

export const appTabBarBorderAccent = 'rgba(255, 255, 255, 0.08)';

export const appBorderAccent = 'rgba(255, 255, 255, 0.12)';

export const appBorderAccentMuted = 'rgba(255, 255, 255, 0.07)';

export const appChromeGradientFadePink = 'rgba(255, 255, 255, 0.10)' as const;

/** Title emphasis — soft purple bloom. */
export const runitTextGlowPink = {
  textShadowColor: 'rgba(192, 132, 252, 0.55)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 8,
} as const;

/** Gold title glow (legacy export name; no cyan). */
export const runitTextGlowCyan = {
  textShadowColor: 'rgba(255, 215, 0, 0.45)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 8,
} as const;

export const runitGlowPinkSoft = {
  shadowColor: 'rgba(192, 132, 252, 0.42)',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 1,
  shadowRadius: 14,
  elevation: 8,
} as const;

export const runitGlowCyanSoft = {
  shadowColor: 'rgba(255, 215, 0, 0.35)',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 1,
  shadowRadius: 12,
  elevation: 8,
} as const;

/** Orbitron family names must match useFonts keys in app/_layout.tsx */
export const runitFont = {
  regular: 'Orbitron_400Regular',
  bold: 'Orbitron_700Bold',
  black: 'Orbitron_900Black',
} as const;
