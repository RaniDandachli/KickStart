/** Daily elimination event — labels, scoring helpers, and `dailyFreeTournamentStore` integration. */

import type { H2hGameKey } from '@/lib/homeOpenMatches';
import { H2H_OPEN_GAMES } from '@/lib/homeOpenMatches';
import type { MatchFinishPayload } from '@/types/match';

export const DAILY_FREE_TOURNAMENT_ROUNDS = 10;
export const DAILY_FREE_PRIZE_USD = 250;

export const DAILY_FREE_ROUND_LABELS = [
  'Round of 1024',
  'Round of 512',
  'Round of 256',
  'Round of 128',
  'Round of 64',
  'Round of 32',
  'Round of 16',
  'Quarter-finals',
  'Semi-finals',
  'Grand Final',
] as const;

export function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Ms until the next local midnight (start of the next calendar day). */
export function msUntilNextLocalMidnight(fromMs: number = Date.now()): number {
  const d = new Date(fromMs);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next.getTime() - fromMs);
}

/** `HH:MM:SS` until local midnight — for “new Tournament of the Day” countdown. */
export function formatCountdownHms(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Which bracket round the player loses on (2–10), or 11 = win out the full bracket today (“crown” path).
 * Round 1 is always a win. Stable for a given calendar day + user key.
 */
export function computeLoseAtRound(dayKey: string, userKey: string): number {
  const h = hash32(`daily_free_v2_10r|${dayKey}|${userKey}`);
  return 2 + (h % 10);
}

export function getRoundLabel(roundIndex1Based: number): string {
  const i = Math.max(1, Math.min(DAILY_FREE_TOURNAMENT_ROUNDS, roundIndex1Based)) - 1;
  return DAILY_FREE_ROUND_LABELS[i] ?? 'Round';
}

const FIRST_NAMES = [
  'Marcus',
  'Jordan',
  'Alex',
  'Riley',
  'Sam',
  'Casey',
  'Morgan',
  'Taylor',
  'Jamie',
  'Cameron',
  'Diego',
  'Priya',
  'Nina',
  'Omar',
  'Elena',
  'Hugo',
  'Lucas',
  'Zara',
  'Ava',
  'Noah',
  'Mia',
  'Ethan',
  'Sofia',
  'Leo',
] as const;

const LAST_NAMES = [
  'Nguyen',
  'Patel',
  'Chen',
  'Rivera',
  'Okonkwo',
  'Silva',
  'Berg',
  'Kowalski',
  'Nakamura',
  'Reyes',
  'Caruso',
  'Hassan',
  'Park',
  "O'Connor",
  'Murphy',
  'Dubois',
  'Garcia',
  'Kim',
  'Singh',
  'Foster',
  'Martin',
  'Cohen',
  'Ali',
  'Jensen',
] as const;

/** Rotating skill games for each bracket match (deterministic per day / round / user). */
export const DAILY_FREE_GAME_ROTATION: H2hGameKey[] = ['tap-dash', 'tile-clash', 'ball-run'];

export function randomOpponentName(userKey: string, roundIndex1Based: number): string {
  const h1 = hash32(`fn|${userKey}|${roundIndex1Based}`);
  const h2 = hash32(`ln|${userKey}|${roundIndex1Based}`);
  return `${FIRST_NAMES[h1 % FIRST_NAMES.length]} ${LAST_NAMES[h2 % LAST_NAMES.length]}`;
}

export function pickDailyGameKey(dayKey: string, roundIndex1Based: number, userKey: string): H2hGameKey {
  const h = hash32(`gamepick|${dayKey}|${roundIndex1Based}|${userKey}`);
  return DAILY_FREE_GAME_ROTATION[h % DAILY_FREE_GAME_ROTATION.length];
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable opponent score line for the round (used with your run to finalize the scoreboard). */
export function computeOpponentRoundScore(
  gameKey: H2hGameKey,
  dayKey: string,
  roundIndex1Based: number,
  userKey: string,
): number {
  const seed = hash32(`opp_round|${gameKey}|${dayKey}|${roundIndex1Based}|${userKey}`);
  const rng = mulberry32(seed);
  const r = () => rng();
  switch (gameKey) {
    case 'tap-dash':
      return 4 + Math.floor(r() * 25);
    case 'tile-clash':
      return 8 + Math.floor(r() * 55);
    case 'ball-run':
      return 220 + Math.floor(r() * 3600);
    default:
      return 10 + Math.floor(r() * 20);
  }
}

export function titleForDailyGame(gameKey: H2hGameKey): string {
  const g = H2H_OPEN_GAMES.find((x) => x.gameKey === gameKey);
  return g?.title ?? 'Skill challenge';
}

export function finalizeDailyScores(
  playerScore: number,
  opponentRoundScore: number,
  forcedOutcome: 'win' | 'lose',
  localPlayerId: string,
  opponentId: string,
): MatchFinishPayload {
  if (forcedOutcome === 'win') {
    const opp = Math.max(0, Math.min(opponentRoundScore, Math.max(0, playerScore - 1)));
    const self = Math.max(playerScore, opp + 1);
    return { winnerId: localPlayerId, finalScore: { self, opponent: opp }, reason: 'normal' };
  }
  const self = Math.max(0, playerScore);
  const opp = Math.max(opponentRoundScore, self + 1);
  return { winnerId: opponentId, finalScore: { self, opponent: opp }, reason: 'normal' };
}
