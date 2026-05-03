/**
 * Withdrawal fee preview — same split math as Edge `walletWithdrawFee.ts`.
 * Basis points come from `platform_economy.withdraw_platform_fee_bps` via `useWithdrawPlatformFeeBps` / `fetchWithdrawPlatformFeeBps`.
 */

/** Minimum cents that must reach Whop after platform fee (matches Edge). */
export const WITHDRAW_MIN_NET_OUT_CENTS = 100;

export function splitWithdrawGrossCents(amountCents: number, feeBps: number): {
  grossCents: number;
  feeCents: number;
  payoutCents: number;
} {
  const fee = Math.floor((amountCents * feeBps) / 10000);
  const payout = Math.max(0, amountCents - fee);
  return { grossCents: amountCents, feeCents: fee, payoutCents: payout };
}

/** True when Edge would reject the withdrawal (net to bank below $1.00). */
export function withdrawNetFailsMinimum(payoutCents: number): boolean {
  return payoutCents < WITHDRAW_MIN_NET_OUT_CENTS;
}
