/** Solo skill challenges — free entry, daily try limits, configurable targets (showcase prizes are policy-dependent). */

export type SoloChallengeDefinition = {
  id: string;
  gameRoute: '/(app)/(tabs)/play/minigames/tap-dash';
  title: string;
  subtitle: string;
  targetScore: number;
  /** Display only until payouts are wired. */
  showcasePrizeUsd: number;
};

export const SOLO_CHALLENGES: readonly SoloChallengeDefinition[] = [
  {
    id: 'tap_dash_100',
    gameRoute: '/(app)/(tabs)/play/minigames/tap-dash',
    title: 'Tap Dash · 100 gates',
    subtitle: 'Beat the run — hit 100 scored gates in one attempt.',
    targetScore: 100,
    showcasePrizeUsd: 100,
  },
] as const;

export function getSoloChallengeById(id: string): SoloChallengeDefinition | undefined {
  return SOLO_CHALLENGES.find((c) => c.id === id);
}

/** Passed into Tap Dash when launched from Solo Challenges. */
export type SoloChallengeBundle = {
  challengeId: string;
  targetScore: number;
  prizeLabel: string;
};
