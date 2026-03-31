import type { RunitBorderAccent } from '@/components/arcade/ArcadeGameRow';
import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';

/** Minigame routes + Arcade-matching visuals (gradients / border) for H2H pickers & Home rows. */
export const H2H_OPEN_GAMES = [
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
    borderAccent: 'cyan' as const satisfies RunitBorderAccent,
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
    borderAccent: 'cyan' as const satisfies RunitBorderAccent,
  },
  {
    gameKey: 'neon-pool' as const,
    title: 'Neon Pocket',
    route: '/(app)/(tabs)/play/minigames/neon-pool',
    bgColors: ['#052e16', '#0f172a', '#14532d'] as const,
    borderAccent: 'cyan' as const satisfies RunitBorderAccent,
  },
] as const;

const HOSTS = [
  'NeonFox',
  'PixelAce',
  'Jordan',
  'Maya',
  'Riley',
  'Sam',
  'Casey',
  'Alex',
  'Sky',
  'Volt',
] as const;

export type H2hLobbyKind = 'host_waiting' | 'empty_pool';

export type HomeOpenMatchRow = {
  id: string;
  gameKey: (typeof H2H_OPEN_GAMES)[number]['gameKey'];
  title: string;
  route: string;
  entryUsd: number;
  prizeUsd: number;
  hostLabel: string;
  postedMinutesAgo: number;
  /** Someone already queued (demo) — you can join them. */
  lobbyKind: H2hLobbyKind;
};

/**
 * Demo “open lobby” board: each row is a game + contest tier (fee + fixed reward) aligned with Home tier cards.
 * Rotates with `epochMs` (e.g. refresh on focus) so the list feels alive without a backend yet.
 * Replace this builder with an API when match lobbies are persisted.
 */
export function buildHomeOpenMatches(epochMs: number): HomeOpenMatchRow[] {
  const tiers = MATCH_ENTRY_TIERS;
  const seed = Math.floor(epochMs / 45_000);
  return H2H_OPEN_GAMES.map((g, i) => {
    const tierIndex = (seed + i * 17 + i * i) % tiers.length;
    const t = tiers[tierIndex];
    const host = HOSTS[(seed + i * 11) % HOSTS.length];
    const postedMinutesAgo = 1 + ((seed * (i + 3) + i * 5) % 14);
    /** Odd rows: someone “in queue”; even: open slot (no one yet — you start search). */
    const lobbyKind: H2hLobbyKind = (seed + i) % 2 === 0 ? 'host_waiting' : 'empty_pool';
    return {
      id: `${g.gameKey}-${t.entry}-${seed}-${i}`,
      gameKey: g.gameKey,
      title: g.title,
      route: g.route,
      entryUsd: t.entry,
      prizeUsd: t.prize,
      hostLabel: host,
      postedMinutesAgo,
      lobbyKind,
    };
  });
}

export function titleForH2hGameKey(gameKey: string): string {
  const g = H2H_OPEN_GAMES.find((x) => x.gameKey === gameKey);
  return g?.title ?? 'Game';
}
