/**
 * Official Run It Arcade crest (hosted). Use for in-app + web; keeps one source of truth.
 * Fallback asset: `assets/images/run-it-arcade-logo.png` (e.g. offline / native splash build).
 */
export const RUN_IT_ARCADE_LOGO_URI =
  'https://www.image2url.com/r2/default/images/1777088422813-9f494cf5-60c6-437c-ae54-2e1bb430bb3e.png' as const;

export const runItArcadeLogoSource = { uri: RUN_IT_ARCADE_LOGO_URI } as const;

/** Hero banner — Tournament of the Day (Events grid). Replace `assets/images/tournament-of-the-day-banner.png` when updating art. */
export const tournamentOfTheDayHeroSource = require('@/assets/images/tournament-of-the-day-banner.png');

/** Friday Cup banner (Events + `friday-cup` screen). */
export const fridayCupBannerSource = require('@/assets/images/friday-cup-banner.png');

/** Weekly Race banner (Events grid + weekly race screen). */
export const weeklyRaceBannerSource = require('@/assets/images/weekly-race-banner.png');

/** Daily Race banner (solo / money tap targets — Events grid). */
export const dailyRaceBannerSource = require('@/assets/images/daily-race-banner.png');

/** Web home hero: arena + trophy art behind "COMPETE. WIN REAL CASH." */
export const competeWinCashHeroSource = require('@/assets/images/hero-compete-win-cash-arena.png');

