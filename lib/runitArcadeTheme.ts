/**
 * RuniT Arcade — palette tuned to the RUN iT Arcade wordmark:
 * midnight purple field, electric indigo–violet frame, magenta “Arcade”, cyan “iT”, cool white text.
 */
export const runit = {
  neonPink: '#ff1a8c',
  neonCyan: '#40e9ff',
  /** Indigo-violet (logo container / R outline energy). */
  neonPurple: '#7b5cff',
  /** Base screen — deep purple-black like the logo tile. */
  bgDeep: '#0a0618',
  bgPanel: 'rgba(22, 12, 42, 0.9)',
  glass: 'rgba(12, 8, 30, 0.72)',
} as const;

/** Full-screen vertical gradient — matches Home tab (`index.tsx` hero). */
export const APP_SCREEN_GRADIENT_COLORS = ['#0a0618', '#140d28', '#1a1034', '#060410'] as const;

export const APP_SCREEN_GRADIENT_LOCATIONS = [0, 0.35, 0.65, 1] as const;

/** Section dividers — indigo-violet (logo frame / top edge glow). */
export const appChromeLinePink = 'rgba(123, 92, 255, 0.48)';

/** Tab bar and floating chrome borders — indigo forward, pairs with magenta CTAs. */
export const appTabBarBorderAccent = 'rgba(129, 110, 255, 0.45)';

/**
 * Default card / control outline — magenta accent (logo “Arcade” / lightning).
 */
export const appBorderAccent = 'rgba(255, 26, 140, 0.4)';

export const appBorderAccentMuted = 'rgba(255, 26, 140, 0.22)';

/** Second stop for thin `LinearGradient` borders (pair with `runit.neonPink`). */
export const appChromeGradientFadePink = 'rgba(255, 26, 140, 0.32)' as const;

/** ~ drop-shadow on magenta titles */
export const runitTextGlowPink = {
  textShadowColor: 'rgba(255, 26, 140, 0.9)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 10,
} as const;

/** Cyan glow — “iT” energy */
export const runitTextGlowCyan = {
  textShadowColor: 'rgba(64, 233, 255, 0.88)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 10,
} as const;

/** Cards / pressed buttons — soft magenta bloom */
export const runitGlowPinkSoft = {
  shadowColor: 'rgba(255, 26, 140, 0.52)',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 1,
  shadowRadius: 15,
  elevation: 10,
} as const;

export const runitGlowCyanSoft = {
  shadowColor: 'rgba(64, 233, 255, 0.42)',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 1,
  shadowRadius: 14,
  elevation: 9,
} as const;

/** Orbitron family names must match useFonts keys in app/_layout.tsx */
export const runitFont = {
  regular: 'Orbitron_400Regular',
  bold: 'Orbitron_700Bold',
  black: 'Orbitron_900Black',
} as const;
