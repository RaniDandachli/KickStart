/** Solo skill challenges — free entry, daily try limits, configurable targets (showcase prizes are policy-dependent). */

export type SoloChallengeDefinition = {
  id: string;
  /** Daily Race opens Tap Dash under Events stack — see tournaments/minigames/tap-dash. */
  gameRoute: '/(app)/(tabs)/tournaments/minigames/tap-dash';
  title: string;
  subtitle: string;
  targetScore: number;
  /** Display only until payouts are wired. */
  showcasePrizeUsd: number;
  /** Overrides default tries/day cap in UI (≤ server RPC for this id). */
  maxAttemptsPerDay?: number;
};

export const SOLO_CHALLENGES: readonly SoloChallengeDefinition[] = [
  {
    id: 'tap_dash_100',
    gameRoute: '/(app)/(tabs)/tournaments/minigames/tap-dash',
    title: 'Tap Dash · 100 gates',
    subtitle: 'Beat the run — hit 100 scored gates in one attempt.',
    targetScore: 100,
    showcasePrizeUsd: 100,
    maxAttemptsPerDay: 10,
  },
] as const;

export function getSoloChallengeById(id: string): SoloChallengeDefinition | undefined {
  return SOLO_CHALLENGES.find((c) => c.id === id);
}

/** Passed into Tap Dash when launched from Solo / Money Challenges. */
export type SoloChallengeBundle = {
  challengeId: string;
  targetScore: number;
  prizeLabel: string;
  /** Overrides default daily attempt cap shown in HUD (≤ server cap per challenge id). */
  maxAttemptsPerDay?: number;
};
