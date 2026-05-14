/** Minigames that support paid 1v1 skill contests + async host queue (must match server + Edge). */
export const H2H_SKILL_CONTEST_GAME_KEYS = [
  'tap-dash',
  'tile-clash',
  'ball-run',
  'dash-duel',
  'turbo-arena',
  'neon-dance',
  'neon-grid',
  'neon-ship',
  'shape-dash',
  'cyber-road',
] as const;

export type H2hSkillContestGameKey = (typeof H2H_SKILL_CONTEST_GAME_KEYS)[number];

const GAME_KEY_TO_MINIGAME_TYPE: Record<H2hSkillContestGameKey, string> = {
  'tap-dash': 'tap_dash',
  'tile-clash': 'tile_clash',
  'ball-run': 'ball_run',
  'dash-duel': 'dash_duel',
  'turbo-arena': 'turbo_arena',
  'neon-dance': 'neon_dance',
  'neon-grid': 'neon_grid',
  'neon-ship': 'neon_ship',
  'shape-dash': 'shape_dash',
  'cyber-road': 'cyber_road',
};

export function isH2hSkillContestGameKey(k: string | undefined | null): k is H2hSkillContestGameKey {
  if (!k) return false;
  return (H2H_SKILL_CONTEST_GAME_KEYS as readonly string[]).includes(k.trim().toLowerCase());
}

/**
 * Async host queue from the app UI (solo run → Edge submit). Shape Dash is WebView-only for H2H;
 * async queue from that embed is deferred — server still accepts shape-dash async rows if wired later.
 */
export function supportsClientAsyncHostQueue(gameKey: string | undefined | null): boolean {
  const g = normalizeH2hSkillContestGameKey(gameKey ?? '');
  if (!g) return false;
  return g !== 'shape-dash';
}

export function normalizeH2hSkillContestGameKey(k: string): H2hSkillContestGameKey | null {
  const g = k.trim().toLowerCase();
  return isH2hSkillContestGameKey(g) ? g : null;
}

/** `match_sessions.game_key` slug → `minigame_scores.game_type` */
export function h2hGameKeyToMinigameType(gameKey: H2hSkillContestGameKey): string {
  return GAME_KEY_TO_MINIGAME_TYPE[gameKey];
}
