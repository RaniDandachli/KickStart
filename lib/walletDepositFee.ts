/**
 * Card processing pass-through on **cash wallet** deposits (aligned with typical card processor pricing).
 * The amount the user **chooses** is credited in full; this fee is **added on top** of the charge.
 */
export const WALLET_DEPOSIT_FEE_PERCENT = 0.029;
export const WALLET_DEPOSIT_FIXED_FEE_CENTS = 30;

export function walletDepositProcessingFeeCents(walletCents: number): number {
  return Math.round(walletCents * WALLET_DEPOSIT_FEE_PERCENT) + WALLET_DEPOSIT_FIXED_FEE_CENTS;
}

export function walletDepositTotalChargeCents(walletCents: number): number {
  return walletCents + walletDepositProcessingFeeCents(walletCents);
}
