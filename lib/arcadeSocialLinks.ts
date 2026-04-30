/**
 * Run It Arcade — official social profile URLs.
 * Used by the web home sidebar (and can be reused in footers).
 * Leave a field empty until you have the real link; taps are disabled when unset.
 */
export const ARCADE_SOCIAL_URLS = {
  discord: '',
  instagram: '',
  /** X (formerly Twitter) */
  x: '',
  youtube: '',
} as const;

export type ArcadeSocialKey = keyof typeof ARCADE_SOCIAL_URLS;
