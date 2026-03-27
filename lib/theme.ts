/**
 * Semantic colors for non–className usages (StyleSheet, icons).
 * Prefer Tailwind + NativeWind in components; this bridges RN APIs.
 */
export const theme = {
  colors: {
    background: '#06080f',
    surface: '#12182a',
    surface2: '#1c2540',
    border: '#2a3555',
    text: '#f4f6ff',
    textMuted: '#9aa4bf',
    primary: '#c8f31c',
    secondary: '#2ee6d6',
    danger: '#ff4d6d',
    warning: '#ffb020',
    success: '#46f0a8',
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
} as const;

export type Theme = typeof theme;
