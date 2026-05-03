import { PUBLIC_SITE_ORIGIN } from '@/lib/publicSiteOrigin';

/** Public marketing origin — also used as canonical base for meta tags (override with EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL). */
export const SEO_SITE_NAME = 'RunitArcade';

export const SEO_DEFAULT_TITLE = `${SEO_SITE_NAME} — Arcade games, head-to-head matches & tournaments`;

export const SEO_DEFAULT_DESCRIPTION =
  'Skill-based mini games, live head-to-head matches, tournaments, and prizes. Play on the web or app — wallet balance, arcade credits, and daily events.';

export function getSeoSiteOrigin(): string {
  return PUBLIC_SITE_ORIGIN;
}

/** Served from `public/og.png` on static web export; replace with a 1200×630 asset when you have one. */
export function getDefaultOgImageUrl(): string {
  return `${getSeoSiteOrigin()}/og.png`;
}

export function getJsonLdWebSite(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SEO_SITE_NAME,
    url: `${getSeoSiteOrigin()}/`,
    description: SEO_DEFAULT_DESCRIPTION,
  };
}
