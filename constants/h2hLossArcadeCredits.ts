/**
 * Head-to-head loss consolation: non-withdrawable Arcade Credits (`profiles.prize_credits`).
 * Server awards the same amounts in `h2h_loss_arcade_credits_for_entry_fee` (migration) — keep in sync.
 */
export const H2H_LOSS_ARCADE_CREDITS_BY_ENTRY_USD: Readonly<Record<number, number>> = {
  1: 60,
  5: 250,
  10: 500,
  20: 1000,
  50: 2500,
  100: 5000,
} as const;

/** Contest entry fee in whole USD (e.g. tier.entry from `MATCH_ENTRY_TIERS`). */
export function getH2hLossArcadeCreditsForEntryUsd(entryUsd: number): number {
  const k = Math.round(entryUsd);
  return H2H_LOSS_ARCADE_CREDITS_BY_ENTRY_USD[k] ?? 0;
}

/** `match_sessions.entry_fee_wallet_cents` — must match known tiers. */
export function getH2hLossArcadeCreditsForEntryFeeWalletCents(entryFeeWalletCents: number): number {
  if (!Number.isFinite(entryFeeWalletCents) || entryFeeWalletCents <= 0) return 0;
  const dollars = Math.round(entryFeeWalletCents / 100);
  return getH2hLossArcadeCreditsForEntryUsd(dollars);
}
