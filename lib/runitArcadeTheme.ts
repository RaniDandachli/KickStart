/**
 * Run It Arcade — **purple** + **gold** (#FFD700) on **black / white** — no turquoise/cyan in chrome.
 * Token `neonCyan` is kept for import compatibility; value is **gold** (replaces old cyan accents).
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
  /** Base screen — true black with a hint of violet. */
  bgDeep: '#050208',
  bgPanel: 'rgba(24, 10, 40, 0.94)',
  glass: 'rgba(10, 6, 20, 0.78)',
} as const;

/** Full-screen vertical gradient — black → deep violet (cinematic, esports). */
export const APP_SCREEN_GRADIENT_COLORS = ['#020103', '#0c0518', '#1a0a2e', '#0a0612'] as const;

export const APP_SCREEN_GRADIENT_LOCATIONS = [0, 0.32, 0.65, 1] as const;

/** Section dividers & tab chrome — neon purple rim. */
export const appChromeLinePink = 'rgba(168, 85, 247, 0.45)';

export const appTabBarBorderAccent = 'rgba(192, 132, 252, 0.4)';

export const appBorderAccent = 'rgba(192, 132, 252, 0.45)';

export const appBorderAccentMuted = 'rgba(168, 85, 247, 0.22)';

export const appChromeGradientFadePink = 'rgba(192, 132, 252, 0.32)' as const;

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
