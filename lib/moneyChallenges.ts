/**
 * Money Challenges — showcase cash targets (skill contest; payouts eligibility/verification by operator rules).
 * - Free tier: refresh daily · fixed try budget (usually 10) · Tap Dash gates target.
 * - Paid tier: small wallet debit once per local day before attempts count — higher showcase pools.
 */

import type { SoloChallengeBundle } from '@/lib/soloChallenges';

export type MoneyChallengeKind = 'free' | 'paid';

export type MoneyChallengeDefinition = {
  id: string;
  /** Human label for payouts / UI */
  slug: string;
  kind: MoneyChallengeKind;
  title: string;
  subtitle: string;
  /** Minigame route segment under play/minigames (no leading slash). */
  minigameSegment: string;
  targetScore: number;
  showcasePrizeUsd: number;
  /** Max scored runs per local calendar day (client + RPC must align). */
  maxAttemptsPerDay: number;
  /** Paid only — wallet debit in cents once per calendar day via `enter_money_challenge_wallet`. */
  entryFeeWalletCents?: number;
};

/** Free Tap Dash 100 gates → $100 showcase — 10 tries/day. */
export const MONEY_FREE_TAP100_ID = 'tap_dash_100' as const;

/** Paid Tap Dash tier — unlock with wallet · 10 tries after paying. */
export const MONEY_PAID_TAP_HOT_ID = 'money_tapdash_hot' as const;

export const MONEY_CHALLENGES: readonly MoneyChallengeDefinition[] = [
  {
    id: MONEY_FREE_TAP100_ID,
    slug: 'tap-dash-100-showcase',
    kind: 'free',
    title: 'Tap Dash · hit 100 gates',
    subtitle: 'One run · reach 100 scored gates · free entry every calendar day.',
    minigameSegment: 'tap-dash',
    targetScore: 100,
    showcasePrizeUsd: 100,
    maxAttemptsPerDay: 10,
  },
  {
    id: MONEY_PAID_TAP_HOT_ID,
    slug: 'tap-dash-hot-pot',
    kind: 'paid',
    title: 'Tap Dash · Vault Run',
    subtitle: `$5 wallet entry unlocks today's attempts · chase ${150} gates for a bigger showcase pool.`,
    minigameSegment: 'tap-dash',
    targetScore: 150,
    showcasePrizeUsd: 250,
    maxAttemptsPerDay: 10,
    entryFeeWalletCents: 500,
  },
] as const;

export function getMoneyChallengeById(id: string): MoneyChallengeDefinition | undefined {
  return MONEY_CHALLENGES.find((c) => c.id === id);
}

/** Build SoloChallengeBundle consumed by TapDashGame (+ maxAttempts overlay). */
export function toSoloChallengeBundle(def: MoneyChallengeDefinition): SoloChallengeBundle {
  const prizeLabel = `$${def.showcasePrizeUsd} showcase`;
  return {
    challengeId: def.id,
    targetScore: def.targetScore,
    prizeLabel,
    maxAttemptsPerDay: def.maxAttemptsPerDay,
  };
}

export function isPaidMoneyChallengeId(id: string): boolean {
  return getMoneyChallengeById(id)?.kind === 'paid';
}
