import type { RunitBorderAccent } from '@/components/arcade/ArcadeGameRow';
import {
  SHOW_BALL_RUN_MINIGAME,
  SHOW_DASH_DUEL_MINIGAME,
  SHOW_NEON_SHIP_MINIGAME,
  SHOW_STREET_DASH_MINIGAME,
  SHOW_TURBO_ARENA_MINIGAME,
} from '@/constants/featureFlags';

/** Charcoal game tiles — brand color only on borders / CTAs (see `borderAccent`). */
export const GAME_ROW_SHELL_BG = ['#121214', '#18181B', '#101012'] as const;

/** Full list (includes vaulted games) — use for titles, server keys, in-flight matches. */
export const H2H_OPEN_GAMES_ALL = [
  {
    gameKey: 'tap-dash' as const,
    title: 'Tap Dash',
    route: '/(app)/(tabs)/play/minigames/tap-dash',
    bgColors: GAME_ROW_SHELL_BG,
    borderAccent: 'gold' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'tile-clash' as const,
    title: 'Tile Clash',
    route: '/(app)/(tabs)/play/minigames/tile-clash',
    bgColors: GAME_ROW_SHELL_BG,
    borderAccent: 'purple' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'dash-duel' as const,
    title: 'Dash Duel',
    route: '/(app)/(tabs)/play/minigames/dash-duel',
    bgColors: GAME_ROW_SHELL_BG,
    borderAccent: 'gold' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'ball-run' as const,
    title: 'Neon Ball Run',
    route: '/(app)/(tabs)/play/minigames/ball-run',
    bgColors: GAME_ROW_SHELL_BG,
    borderAccent: 'pink' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'turbo-arena' as const,
    title: 'Turbo Arena',
    route: '/(app)/(tabs)/play/minigames/turbo-arena',
    bgColors: GAME_ROW_SHELL_BG,
    borderAccent: 'gold' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'neon-dance' as const,
    title: 'Neon Dance',
    route: '/(app)/(tabs)/play/minigames/neon-dance',
    bgColors: GAME_ROW_SHELL_BG,
    borderAccent: 'pink' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'neon-grid' as const,
    title: 'Street Dash',
    route: '/(app)/(tabs)/play/minigames/neon-grid',
    bgColors: GAME_ROW_SHELL_BG,
    borderAccent: 'purple' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'neon-ship' as const,
    title: 'Void Glider',
    route: '/(app)/(tabs)/play/minigames/neon-ship',
    bgColors: GAME_ROW_SHELL_BG,
    borderAccent: 'pink' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'shape-dash' as const,
    title: 'Shape Dash',
    /** Head-to-head: endless Marathon only (single mode for competitive runs). */
    route: '/(app)/(tabs)/play/minigames/shape-dash?mode=marathon',
    bgColors: GAME_ROW_SHELL_BG,
    borderAccent: 'gold' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'cyber-road' as const,
    title: 'Cyber Road',
    route: '/(app)/(tabs)/play/minigames/cyber-road',
    bgColors: GAME_ROW_SHELL_BG,
    borderAccent: 'purple' as const satisfies RunitBorderAccent,
  },
] as const;

export type H2hGameKey = (typeof H2H_OPEN_GAMES_ALL)[number]['gameKey'];

/** Shown in H2H pickers & home open-match rows (respects vault flags). */
export const H2H_OPEN_GAMES = H2H_OPEN_GAMES_ALL.filter((g) => {
  if (g.gameKey === 'neon-ship' && !SHOW_NEON_SHIP_MINIGAME) return false;
  if (g.gameKey === 'dash-duel' && !SHOW_DASH_DUEL_MINIGAME) return false;
  if (g.gameKey === 'ball-run' && !SHOW_BALL_RUN_MINIGAME) return false;
  if (g.gameKey === 'neon-grid' && !SHOW_STREET_DASH_MINIGAME) return false;
  if (g.gameKey === 'turbo-arena' && !SHOW_TURBO_ARENA_MINIGAME) return false;
  return true;
});

/** Server sentinel for Quick Match wildcard rows in `h2h_queue_entries` / RPC (not a real minigame). */
export const H2H_QUICK_MATCH_GAME_KEY = '__quick_match__' as const;

export type H2hLobbyKind = 'host_waiting' | 'empty_pool';

export function titleForH2hGameKey(gameKey: string): string {
  const g = H2H_OPEN_GAMES_ALL.find((x) => x.gameKey === gameKey);
  return g?.title ?? 'Game';
}
