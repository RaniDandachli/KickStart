/**
 * RuniT Arcade — palette aligned with the KickClash wordmark:
 * deep navy field, electric blue highlights, soft neon pink accents, cool white text.
 * (Keeps token names like `neonCyan` for compatibility — value reads as logo blue.)
 */
export const runit = {
  neonPink: '#ff5cb8',
  neonCyan: '#5cb4ff',
  /** Blue–violet bridge for gradients (pairs pink + blue without heavy purple). */
  neonPurple: '#6b8cff',
  /** Base screen — blue-black, calmer than pure purple. */
  bgDeep: '#070b18',
  bgPanel: 'rgba(14, 22, 44, 0.92)',
  glass: 'rgba(10, 16, 36, 0.74)',
} as const;

/** Full-screen vertical gradient — matches Home tab (`index.tsx` hero). */
export const APP_SCREEN_GRADIENT_COLORS = ['#070b18', '#0d152c', '#121f3d', '#060914'] as const;

export const APP_SCREEN_GRADIENT_LOCATIONS = [0, 0.35, 0.65, 1] as const;

/** Section dividers — soft electric blue rim. */
export const appChromeLinePink = 'rgba(100, 170, 255, 0.4)';

/** Tab bar and floating chrome borders — blue-forward, pairs with pink CTAs. */
export const appTabBarBorderAccent = 'rgba(110, 175, 255, 0.42)';

/**
 * Default card / control outline — soft neon pink (readable, not harsh).
 */
export const appBorderAccent = 'rgba(255, 100, 190, 0.38)';

export const appBorderAccentMuted = 'rgba(255, 100, 190, 0.2)';

/** Second stop for thin `LinearGradient` borders (pair with `runit.neonPink`). */
export const appChromeGradientFadePink = 'rgba(255, 100, 190, 0.28)' as const;

/** Title emphasis — subtle pink bloom (not heavy glow). */
export const runitTextGlowPink = {
  textShadowColor: 'rgba(255, 100, 190, 0.55)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 7,
} as const;

/** Blue title emphasis — matches `neonCyan` (electric blue). */
export const runitTextGlowCyan = {
  textShadowColor: 'rgba(110, 190, 255, 0.5)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 7,
} as const;

/** Cards / pressed buttons — soft pink bloom */
export const runitGlowPinkSoft = {
  shadowColor: 'rgba(255, 100, 190, 0.38)',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 1,
  shadowRadius: 12,
  elevation: 8,
} as const;

export const runitGlowCyanSoft = {
  shadowColor: 'rgba(100, 185, 255, 0.32)',
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
