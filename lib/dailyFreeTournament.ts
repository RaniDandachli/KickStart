/** Client-only promotional “Tournament of the Day” — tune in `dailyFreeTournamentStore` + UI copy. */

export const DAILY_FREE_TOURNAMENT_ROUNDS = 8;
export const DAILY_FREE_PRIZE_USD = 100;

export const DAILY_FREE_ROUND_LABELS = [
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

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Which bracket round the player loses on (2–8). Round 1 is always a win.
 * Stable for a given calendar day + user key.
 */
export function computeLoseAtRound(dayKey: string, userKey: string): number {
  const h = hash32(`daily_free_v1|${dayKey}|${userKey}`);
  return 2 + (h % 7);
}

export function getRoundLabel(roundIndex1Based: number): string {
  const i = Math.max(1, Math.min(DAILY_FREE_TOURNAMENT_ROUNDS, roundIndex1Based)) - 1;
  return DAILY_FREE_ROUND_LABELS[i] ?? 'Round';
}

const OPPONENTS = [
  'NeonNova',
  'ByteRider',
  'GlitchKix',
  'VoltVandal',
  'PixelPunk',
  'TurboGhost',
  'SynthStriker',
  'ArcadeAce',
  'RetroRival',
  'CyberSlugger',
] as const;

export function randomOpponentName(userKey: string, roundIndex1Based: number): string {
  const h = hash32(`opp|${userKey}|${roundIndex1Based}`);
  return OPPONENTS[h % OPPONENTS.length];
}
