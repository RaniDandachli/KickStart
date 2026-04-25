import type { RunitBorderAccent } from '@/components/arcade/ArcadeGameRow';
import { SHOW_NEON_SHIP_MINIGAME } from '@/constants/featureFlags';

/** Full list (includes vaulted games) — use for titles, server keys, in-flight matches. */
export const H2H_OPEN_GAMES_ALL = [
  {
    gameKey: 'tap-dash' as const,
    title: 'Tap Dash',
    route: '/(app)/(tabs)/play/minigames/tap-dash',
    bgColors: ['#1e1b4b', '#312e81', '#4c1d95'] as const,
    borderAccent: 'pink' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'tile-clash' as const,
    title: 'Tile Clash',
    route: '/(app)/(tabs)/play/minigames/tile-clash',
    bgColors: ['#0f172a', '#1e1b4b', '#5b21b6'] as const,
    borderAccent: 'purple' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'dash-duel' as const,
    title: 'Dash Duel',
    route: '/(app)/(tabs)/play/minigames/dash-duel',
    bgColors: ['#020617', '#0c4a6e', '#164e63'] as const,
    borderAccent: 'gold' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'ball-run' as const,
    title: 'Neon Ball Run',
    route: '/(app)/(tabs)/play/minigames/ball-run',
    bgColors: ['#1a0b2e', '#4c1d95', '#831843'] as const,
    borderAccent: 'pink' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'turbo-arena' as const,
    title: 'Turbo Arena',
    route: '/(app)/(tabs)/play/minigames/turbo-arena',
    bgColors: ['#020617', '#0c4a6e', '#7c2d12'] as const,
    borderAccent: 'gold' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'neon-dance' as const,
    title: 'Neon Dance',
    route: '/(app)/(tabs)/play/minigames/neon-dance',
    bgColors: ['#050508', '#1e1b4b', '#312e81'] as const,
    borderAccent: 'pink' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'neon-grid' as const,
    title: 'Street Dash',
    route: '/(app)/(tabs)/play/minigames/neon-grid',
    bgColors: ['#0f172a', '#312e81', '#831843'] as const,
    borderAccent: 'purple' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'neon-ship' as const,
    title: 'Void Glider',
    route: '/(app)/(tabs)/play/minigames/neon-ship',
    bgColors: ['#1a0a2e', '#4c1d95', '#0f0220'] as const,
    borderAccent: 'pink' as const satisfies RunitBorderAccent,
  },
] as const;

export type H2hGameKey = (typeof H2H_OPEN_GAMES_ALL)[number]['gameKey'];

/** Shown in H2H pickers & home open-match rows (respects {@link SHOW_NEON_SHIP_MINIGAME}). */
export const H2H_OPEN_GAMES = SHOW_NEON_SHIP_MINIGAME
  ? H2H_OPEN_GAMES_ALL
  : H2H_OPEN_GAMES_ALL.filter((g) => g.gameKey !== 'neon-ship');

/** Server sentinel for Quick Match wildcard rows in `h2h_queue_entries` / RPC (not a real minigame). */
export const H2H_QUICK_MATCH_GAME_KEY = '__quick_match__' as const;

export type H2hLobbyKind = 'host_waiting' | 'empty_pool';

export function titleForH2hGameKey(gameKey: string): string {
  const g = H2H_OPEN_GAMES_ALL.find((x) => x.gameKey === gameKey);
  return g?.title ?? 'Game';
}
