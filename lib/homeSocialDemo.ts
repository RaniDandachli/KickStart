/**
 * Home marketing defaults — when lobby stats are empty or zero, show plausible social proof.
 * Amounts in USD cents; cap under $450 for display.
 */
export const DEFAULT_ONLINE_PLAYERS = 17;

const MAX_EARNER_CENTS = 45_000;

/** 24h “top earner” rows: realistic gaming / Reddit–style names; dollars rotate, never above $450. */
export const FAKE_TOP_EARNER_FRAMES: ReadonlyArray<
  ReadonlyArray<{ readonly username: string; readonly cents: number }>
> = [
  [
    { username: 'prizeRunHopium', cents: 43_000 },
    { username: 'tilted_but_its_fine', cents: 19_000 },
    { username: 'WhopGoesThere', cents: 7_500 },
    { username: 'KeyboardCatKiller', cents: 28_000 },
  ],
  [
    { username: 'arcadeDemon420', cents: 19_000 },
    { username: 'VoidRunnerDad', cents: 43_000 },
    { username: 'TouchGrass_Never', cents: 32_000 },
    { username: 'rankedSweat1999', cents: 11_200 },
  ],
  [
    { username: 'L_for_Latency', cents: 7_500 },
    { username: 'NeonDanceDad_', cents: 33_000 },
    { username: 'StreetDashGoon', cents: 43_000 },
    { username: 'skill_issue_fr', cents: 8_800 },
  ],
  [
    { username: 'clutchOrBust_', cents: 43_000 },
    { username: 'ur_local_carry_', cents: 19_000 },
    { username: 'POGchamp_irl', cents: 42_000 },
    { username: 'DailyResetVictim', cents: 16_500 },
  ],
  [
    { username: 'Casual_JustKidding', cents: 19_000 },
    { username: 'TurboLossSession', cents: 2_100 },
    { username: 'QueueIsMyHome', cents: 43_000 },
    { username: 'FreeBracketBandit', cents: 27_500 },
  ],
] as const;

if (__DEV__) {
  for (const frame of FAKE_TOP_EARNER_FRAMES) {
    for (const row of frame) {
      if (row.cents > MAX_EARNER_CENTS) {
        throw new Error(`homeSocialDemo: ${row.username} exceeds $450 cap`);
      }
    }
  }
}

export const FAKE_TOP_EARNERS_ROTATION_MS = 4_200;
