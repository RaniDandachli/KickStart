/**
 * Daily Race (UI name; tables `weekly_race_*`) — paid leaderboard ($10), 10 scored runs, rotating minigame (excludes Stacker + Turbo Arena).
 * The playable game changes every calendar day (`todayYmdLocal`).
 * Top 3 real entrants by `best_score` get $200 / $50 / $30 (wallet) after that date ends (UTC) — RPC `finalize_weekly_race_pending_days`.
 *
 * Server RPCs: `enter_weekly_race`, `record_weekly_race_score`; settlement: `finalize_weekly_race_pending_days`.
 */

import { H2H_OPEN_GAMES_ALL, titleForH2hGameKey, type H2hGameKey } from '@/lib/homeOpenMatches';
import { h2hBracketGameRotationForClient } from '@/lib/h2hGameRotation';
import { todayYmdLocal } from '@/lib/dailyFreeTournament';
import { Platform } from 'react-native';
import { SHOW_NEON_SHIP_MINIGAME } from '@/constants/featureFlags';

/** Cash entry (wallet_cents) — $10. */
export const WEEKLY_RACE_ENTRY_FEE_CENTS = 10_00;

/** Max completed scored runs per calendar day (after you’ve paid to enter). */
export const WEEKLY_RACE_MAX_ATTEMPTS = 10;

export const WEEKLY_RACE_PAYOUTS_USD = {
  first: 200,
  second: 50,
  third: 30,
} as const;

/** Never in pool (Stacker = arcade only; Turbo Arena / “Turbo Clash” = excluded). */
const EXCLUDED: ReadonlySet<H2hGameKey> = new Set(['turbo-arena']);

const BASE_CANDIDATES: readonly H2hGameKey[] = H2H_OPEN_GAMES_ALL.filter(
  (g) => !EXCLUDED.has(g.gameKey),
).map((g) => g.gameKey);

/**
 * All platforms: games that can participate (native may include 3D). Web uses client subset when picking.
 */
export function weeklyRaceAllCandidateKeys(): H2hGameKey[] {
  if (!SHOW_NEON_SHIP_MINIGAME) {
    return BASE_CANDIDATES.filter((k) => k !== 'neon-ship');
  }
  return [...BASE_CANDIDATES];
}

/**
 * Minigame keys the current client can actually open (web skips heavy native titles).
 * Must stay in sync with `h2hBracketGameRotationForClient` intent.
 */
export function weeklyRaceClientPlayableKeys(): H2hGameKey[] {
  const allow = new Set(h2hBracketGameRotationForClient() as readonly H2hGameKey[]);
  return weeklyRaceAllCandidateKeys().filter((k) => allow.has(k));
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** YYYY-MM-DD in local time (same as Tournament of the Day). */
export function weeklyRaceDayKey(d = new Date()): string {
  void d;
  return todayYmdLocal();
}

/** Next calendar date in local timezone (preview “tomorrow’s” rotating game label). */
export function nextWeeklyRaceDayKey(now = new Date()): string {
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * One rotating game per day, stable for everyone, different tomorrow.
 * On web, only picks from games that run in the browser.
 */
export function pickWeeklyRaceGameKey(dayKey: string = weeklyRaceDayKey()): H2hGameKey {
  const pool =
    Platform.OS === 'web' ? weeklyRaceClientPlayableKeys() : weeklyRaceAllCandidateKeys();
  if (pool.length === 0) {
    return 'tap-dash';
  }
  const h = hash32(`weekly_race_v1_game|${dayKey}`);
  return pool[h % pool.length]!;
}

export type WeeklyRaceLeaderboardRow = {
  rank: number;
  name: string;
  score: number;
  isYou: boolean;
  prizeLabel?: string;
};

const FIRST = ['Marcus', 'Jordan', 'Alex', 'Riley', 'Sam', 'Casey', 'Morgan', 'Jamie', 'Avery', 'Quinn'] as const;
const LAST = ['Nguyen', 'Patel', 'Reyes', 'Berg', 'Nakamura', 'Kowalski', 'Vega', 'Costa', 'Diaz', 'Silva'] as const;

/**
 * Plausible “NPC” high scores; tier 1 is intentionally above normal human play for that game idiom.
 * Real user is merged; sorted descending by score.
 */
function npcScoreTiers(
  dayKey: string,
  gameKey: H2hGameKey,
): { name: string; score: number; tier: 1 | 2 | 3 | 4 }[] {
  const h = (slot: string) => hash32(`wr_npc|v1|${dayKey}|${gameKey}|${slot}`);
  const s1 = 550_000 + (h('t1') % 80_000);
  const s2 = 120_000 + (h('t2') % 40_000);
  const s3 = 45_000 + (h('t3') % 12_000);
  const n = 6 + (h('n') % 4);
  const rows: { name: string; score: number; tier: 1 | 2 | 3 | 4 }[] = [
    { name: 'SynthPulse', score: s1, tier: 1 },
    { name: 'VectorNull', score: s2, tier: 2 },
    { name: 'GlitchKix', score: s3, tier: 3 },
  ];
  for (let i = 0; i < n; i++) {
    const hi = hash32(`wr_npc|row|${dayKey}|${gameKey}|${i}`);
    const score = 8_000 + (hi % 18_000) + i * 400;
    rows.push({
      name: `${FIRST[hi % FIRST.length]} ${LAST[(hi >> 3) % LAST.length]}`,
      score,
      tier: 4,
    });
  }
  return rows;
}

/**
 * 9–12 visible rows: synthetic rivals + the player’s best (if any). Ranks 1–3 get prize labels.
 */
export function buildWeeklyRaceLeaderboardView(params: {
  dayKey: string;
  gameKey: H2hGameKey;
  yourBest: number | null;
  yourDisplayName: string;
}): WeeklyRaceLeaderboardRow[] {
  const pool = npcScoreTiers(params.dayKey, params.gameKey);
  if (params.yourBest != null && params.yourBest >= 0) {
    pool.push({ name: params.yourDisplayName, score: params.yourBest, tier: 4 });
  } else {
    pool.push({ name: params.yourDisplayName, score: 0, tier: 4 });
  }
  const sorted = pool.sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 12);
  return top.map((r, i) => {
    const rank = i + 1;
    const prizeLabel =
      rank === 1
        ? `$${WEEKLY_RACE_PAYOUTS_USD.first} (1st)`
        : rank === 2
          ? `$${WEEKLY_RACE_PAYOUTS_USD.second} (2nd)`
          : rank === 3
            ? `$${WEEKLY_RACE_PAYOUTS_USD.third} (3rd)`
            : undefined;
    return {
      rank,
      name: r.name,
      score: r.score,
      isYou: r.name === params.yourDisplayName,
      prizeLabel,
    };
  });
}

const ARCADE_MINIGAMES = '/(app)/(tabs)/play/minigames';
const EVENTS_MINIGAMES = '/(app)/(tabs)/tournaments/minigames';

/**
 * Opens the playable URL on the Events stack (`tournaments/minigames/…`), not Arcade, so switching to
 * the Play tab stays on the arcade hub after a run exits to Daily Race leaderboard / Events.
 */
export function routeForWeeklyRaceGameKey(gameKey: H2hGameKey): string | null {
  const g = H2H_OPEN_GAMES_ALL.find((x) => x.gameKey === gameKey);
  if (!g?.route) return null;
  return g.route.replace(ARCADE_MINIGAMES, EVENTS_MINIGAMES);
}

export function labelForWeeklyRaceGame(gameKey: H2hGameKey): string {
  return titleForH2hGameKey(gameKey);
}
