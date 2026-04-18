/**
 * RuniT Arcade — neon cyberpunk tokens (see DESIGN_SYSTEM.md).
 */
export const runit = {
  neonPink: '#ff006e',
  neonCyan: '#00f0ff',
  neonPurple: '#9d4edd',
  bgDeep: '#06020e',
  bgPanel: 'rgba(12, 6, 22, 0.88)',
  glass: 'rgba(8, 4, 18, 0.72)',
} as const;

/** Full-screen vertical gradient — matches Home tab (`index.tsx` hero). */
export const APP_SCREEN_GRADIENT_COLORS = ['#06020e', '#12081f', '#0c0618', '#050208'] as const;

export const APP_SCREEN_GRADIENT_LOCATIONS = [0, 0.35, 0.65, 1] as const;

/** Section dividers / underlines — pink-forward (same family as Home “PLAY NOW”). */
export const appChromeLinePink = 'rgba(255, 0, 110, 0.42)';

/** Tab bar and floating chrome borders. */
export const appTabBarBorderAccent = 'rgba(255, 0, 110, 0.4)';

/**
 * Default card / control outline on dark screens — pink primary + readable on `#06020e`.
 * (Replaces older purple-only `rgba(157,78,237,0.45)` in newer UI passes.)
 */
export const appBorderAccent = 'rgba(255, 0, 110, 0.38)';

export const appBorderAccentMuted = 'rgba(255, 0, 110, 0.22)';

/** Second stop for thin `LinearGradient` borders (pair with `runit.neonPink`). */
export const appChromeGradientFadePink = 'rgba(255, 0, 110, 0.3)' as const;

/** ~ drop-shadow 0 0 10px #ff006e on text */
export const runitTextGlowPink = {
  textShadowColor: 'rgba(255, 0, 110, 0.92)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 10,
} as const;

/** Cyan glow for secondary titles */
export const runitTextGlowCyan = {
  textShadowColor: 'rgba(0, 240, 255, 0.85)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 10,
} as const;

/** shadow-[0_0_15px_rgba(255,0,110,0.5)] — cards / pressed buttons */
export const runitGlowPinkSoft = {
  shadowColor: 'rgba(255, 0, 110, 0.55)',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 1,
  shadowRadius: 15,
  elevation: 10,
} as const;

export const runitGlowCyanSoft = {
  shadowColor: 'rgba(0, 240, 255, 0.45)',
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
