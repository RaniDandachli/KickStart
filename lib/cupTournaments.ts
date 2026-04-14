/**
 * Single-elimination “credit cups” — same bracket flow as Tournament of the Day, with fixed prize_credits payouts.
 */

import type { H2hGameKey } from '@/lib/homeOpenMatches';

export type CreditCupDefinition = {
  id: string;
  name: string;
  subtitle: string;
  prizeCredits: 1000 | 2000 | 3000 | 4000 | 5000;
  accent: 'cyan' | 'purple' | 'pink' | 'amber' | 'emerald';
};

/** Ordered tiers — win all rounds in a run to earn prize credits (server-granted when backend on). */
export const CREDIT_CUPS: readonly CreditCupDefinition[] = [
  { id: 'cup-1000', name: 'Bronze Cup', subtitle: '10 rounds · single elimination', prizeCredits: 1000, accent: 'amber' },
  { id: 'cup-2000', name: 'Silver Cup', subtitle: '10 rounds · single elimination', prizeCredits: 2000, accent: 'cyan' },
  { id: 'cup-3000', name: 'Gold Cup', subtitle: '10 rounds · single elimination', prizeCredits: 3000, accent: 'emerald' },
  { id: 'cup-4000', name: 'Platinum Cup', subtitle: '10 rounds · single elimination', prizeCredits: 4000, accent: 'purple' },
  { id: 'cup-5000', name: 'Champion Cup', subtitle: '10 rounds · single elimination', prizeCredits: 5000, accent: 'pink' },
] as const;

export function getCreditCupById(id: string): CreditCupDefinition | undefined {
  return CREDIT_CUPS.find((c) => c.id === id);
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
 * Which round the player loses on (2–10), or 11 = clear full bracket (cup win) today.
 * Same shape as daily free; salted per cup so each cup feels distinct.
 */
export function computeCupLoseAtRound(dayKey: string, userKey: string, cupId: string): number {
  const h = hash32(`cup_bracket_v3|${cupId}|${dayKey}|${userKey}`);
  const roll = h % 100;
  switch (cupId) {
    case 'cup-1000': // Bronze: easiest tier, but wins are still uncommon so credits stay valuable.
      if (roll < 18) return 11;
      return 5 + (h % 6); // lose 5..10
    case 'cup-2000': // Silver: a bit harder than Bronze.
      if (roll < 10) return 11;
      return 5 + (h % 6); // lose 5..10
    case 'cup-3000': // Gold: no free crowns — grind or shop credits.
      return 4 + (h % 7); // lose 4..10
    case 'cup-4000': // Platinum: very hard.
      return 3 + (h % 7); // lose 3..9
    case 'cup-5000': // Champion: never cleared (showcase / aspiration tier).
      return 2 + (h % 7); // lose 2..8
    default:
      return 2 + (h % 9); // lose 2..10
  }
}

export function pickCupGameKey(dayKey: string, roundIndex1Based: number, userKey: string, cupId: string): H2hGameKey {
  const h = hash32(`gamepick_cup|${cupId}|${dayKey}|${roundIndex1Based}|${userKey}`);
  const rot: readonly H2hGameKey[] = ['tap-dash', 'tile-clash', 'ball-run'];
  return rot[h % rot.length]!;
}

export function randomCupOpponentName(userKey: string, roundIndex1Based: number, cupId: string): string {
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
  ] as const;
  const h1 = hash32(`cup_fn|${cupId}|${userKey}|${roundIndex1Based}`);
  const h2 = hash32(`cup_ln|${cupId}|${userKey}|${roundIndex1Based}`);
  return `${FIRST_NAMES[h1 % FIRST_NAMES.length]} ${LAST_NAMES[h2 % LAST_NAMES.length]}`;
}
