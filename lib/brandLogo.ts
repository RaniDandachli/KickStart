/**
 * Official Run It Arcade crest (hosted). Use for in-app + web; keeps one source of truth.
 * Fallback asset: `assets/images/run-it-arcade-logo.png` (e.g. offline / native splash build).
 */
export const RUN_IT_ARCADE_LOGO_URI =
  'https://www.image2url.com/r2/default/images/1777088422813-9f494cf5-60c6-437c-ae54-2e1bb430bb3e.png' as const;

export const runItArcadeLogoSource = { uri: RUN_IT_ARCADE_LOGO_URI } as const;

/** Hero art for the Tournament of the Day card (Events carousel). */
export const TOURNAMENT_OF_THE_DAY_HERO_URI =
  'https://www.image2url.com/r2/default/images/1777087549347-78bd2585-50ab-4dae-b988-2cebf4002e62.png' as const;

export const tournamentOfTheDayHeroSource = { uri: TOURNAMENT_OF_THE_DAY_HERO_URI } as const;

/** Web home hero: arena + trophy art behind "COMPETE. WIN REAL CASH." */
export const competeWinCashHeroSource = require('@/assets/images/hero-compete-win-cash-arena.png');

/** Friday Cup promotional banner (Events carousel + `friday-cup` screen). */
export const fridayCupBannerSource = require('@/assets/images/friday-cup-banner.png');
