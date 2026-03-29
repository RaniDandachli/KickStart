/**
 * Big-arcade palette — neon accents on warm / deep surfaces.
 */
export const theme = {
  colors: {
    background: '#FAF5FF',
    backgroundDeep: '#1E1B4B',
    surface: '#FFFFFF',
    surfaceMuted: '#F5F3FF',
    border: '#E9D5FF',
    text: '#1E1B4B',
    textMuted: '#6B21A8',
    /** Primary — electric magenta */
    accent: '#C026D3',
    accentDark: '#86198F',
    accentMuted: '#F5D0FE',
    /** Cyan pop */
    secondary: '#0891B2',
    secondaryMuted: '#CFFAFE',
    /** Gold highlights */
    gold: '#FBBF24',
    goldDark: '#D97706',
    danger: '#EF4444',
    warning: '#F59E0B',
    success: '#22C55E',
  },
  radius: {
    sm: 8,
    md: 14,
    lg: 20,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  shadow: {
    card: {
      shadowColor: '#6B21A8',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 6,
    },
    soft: {
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    /** Chunky arcade button */
    punch: {
      shadowColor: '#86198F',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.35,
      shadowRadius: 0,
      elevation: 5,
    },
  },
} as const;

export type Theme = typeof theme;
