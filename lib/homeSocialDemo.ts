/**
 * Home marketing defaults — when lobby stats are empty or zero, show plausible social proof.
 * Amounts in USD cents; cap under $450 for display.
 */
/** Fallback when legacy code still reads a single int (prefer `useFloatingOnlineCount` in UI). */
export const DEFAULT_ONLINE_PLAYERS = 22;

const MAX_EARNER_CENTS = 45_000;

/** 24h “top earner” rows — human-looking names; dollar amounts vary; never above $450. */
export const FAKE_TOP_EARNER_FRAMES: ReadonlyArray<
  ReadonlyArray<{ readonly username: string; readonly cents: number }>
> = [
  [
    { username: 'Marcus Chen', cents: 38_200 },
    { username: 'Jordan Okonkwo', cents: 19_400 },
    { username: 'Riley Park', cents: 42_100 },
    { username: 'Samir Patel', cents: 27_500 },
  ],
  [
    { username: 'Alex Moreno', cents: 21_000 },
    { username: 'Taylor Brooks', cents: 43_000 },
    { username: 'Casey Nguyen', cents: 12_800 },
    { username: 'Jamie Flores', cents: 33_600 },
  ],
  [
    { username: 'Morgan Reyes', cents: 8_400 },
    { username: 'Chris Weber', cents: 19_200 },
    { username: 'Priya Nair', cents: 40_500 },
    { username: 'D. Bergstrom', cents: 15_100 },
  ],
  [
    { username: 'Elena Varga', cents: 35_000 },
    { username: 'Noah Kline', cents: 19_000 },
    { username: 'Hannah Cho', cents: 41_200 },
    { username: 'Omar Haddad', cents: 9_200 },
  ],
  [
    { username: 'J. Nakamura', cents: 28_400 },
    { username: 'Sofia Rivera', cents: 4_200 },
    { username: 'Tyler Adkins', cents: 43_000 },
    { username: 'Vik Singh', cents: 22_300 },
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

/** Rotating “recent winner” lines for the web home dashboard. */
export const FAKE_RECENT_WINNER_LINES: ReadonlyArray<{
  readonly name: string;
  readonly amountCents: number;
  readonly game: string;
  readonly ago: string;
}> = [
  { name: 'Maya K.', amountCents: 2_800, game: 'Tap Dash', ago: '2m ago' },
  { name: 'Jordan T.', amountCents: 1_200, game: 'Tile Clash', ago: '6m ago' },
  { name: 'Alex P.', amountCents: 3_100, game: 'Dash Duel', ago: '9m ago' },
  { name: 'Riley S.', amountCents: 800, game: 'Neon Ball Run', ago: '14m ago' },
  { name: 'Sam C.', amountCents: 4_500, game: 'Void Glider', ago: '18m ago' },
  { name: 'Casey L.', amountCents: 1_600, game: 'Turbo Arena', ago: '22m ago' },
];
