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
