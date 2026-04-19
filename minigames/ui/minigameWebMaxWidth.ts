import { Platform } from 'react-native';

/** Default max width (px) for minigame playfields on desktop web. */
export const WEB_MINIGAME_STAGE_MAX_WIDTH = 900;

/** Upper bound for immersive play on ultra-wide desktop (keeps lanes readable). */
export const WEB_IMMERSIVE_STAGE_MAX_WIDTH = 1280;

/**
 * Viewports narrower than this (e.g. iPhone Safari) use the same bottom tab shell as native builds;
 * wider web uses the desktop top-tab layout.
 */
export const WEB_TAB_DESKTOP_MIN_WIDTH = 768;

function webViewportUsesDesktopLayout(): boolean {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= WEB_TAB_DESKTOP_MIN_WIDTH;
}

/**
 * Wider cap on desktop web only; mobile web matches native phone width.
 * Re-evaluates on each call so resize/orientation updates work when paired with `useWindowDimensions`.
 */
export function minigameStageMaxWidth(phoneMax: number): number {
  if (Platform.OS !== 'web') return phoneMax;
  return webViewportUsesDesktopLayout() ? WEB_MINIGAME_STAGE_MAX_WIDTH : phoneMax;
}

/**
 * 2D lanes/boards: use almost the full device width (minus gutter), up to 620px on large phones / small tablets.
 * Wider desktop web still uses {@link WEB_MINIGAME_STAGE_MAX_WIDTH} via {@link minigameStageMaxWidth}.
 */
export function minigameResponsiveStageWidth(sw: number): number {
  const target = Math.max(300, Math.min(sw - 24, 620));
  return minigameStageMaxWidth(target);
}

/**
 * Full-bleed playfield width during active gameplay (practice, prize, 1v1, daily bracket).
 * Drops the 620px phone cap and avoids {@link minigameStageMaxWidth}'s fixed 900px desktop ceiling
 * so Tap Dash and siblings use nearly the full device / browser width.
 */
export function minigameImmersiveStageWidth(sw: number): number {
  const gutter = 8;
  const raw = Math.max(280, sw - gutter * 2);
  if (Platform.OS === 'web' && webViewportUsesDesktopLayout()) {
    return Math.min(raw, WEB_IMMERSIVE_STAGE_MAX_WIDTH);
  }
  return raw;
}
