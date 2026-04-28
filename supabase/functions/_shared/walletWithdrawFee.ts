/** Shared cash-out economics for Edge Functions (withdrawWalletToConnect / withdrawWalletToWhop). */

const MIN_BANK_PAYOUT_CENTS = 100; // Stripe / minimum $1 transfer to connected account

/**
 * Withdraw fee rate lives in `platform_economy.withdraw_platform_fee_bps` (single source — no duplicated Edge secrets).
 */
// deno-lint-ignore no-explicit-any
export async function fetchWithdrawPlatformFeeBps(admin: any): Promise<number> {
  const { data, error } = await admin.from('platform_economy').select('withdraw_platform_fee_bps').eq('id', 1).maybeSingle();
  if (error || !data) return 0;
  const raw = data.withdraw_platform_fee_bps as number | string | null | undefined;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n >= 0 && n <= 9999 ? n : 0;
}

export function splitWithdrawGrossCents(amountCents: number, feeBps: number): {
  grossCents: number;
  feeCents: number;
  payoutCents: number;
} {
  const fee = Math.floor((amountCents * feeBps) / 10000);
  const payout = Math.max(0, amountCents - fee);
  return { grossCents: amountCents, feeCents: fee, payoutCents: payout };
}

export function assertPayoutMeansMinimumBankTransfer(payoutCents: number, feeCents: number): string | null {
  if (payoutCents < MIN_BANK_PAYOUT_CENTS) {
    return feeCents > 0
      ? `After platform fee the bank transfer would be ${(payoutCents / 100).toFixed(2)} USD — withdraw more so at least ${(MIN_BANK_PAYOUT_CENTS / 100).toFixed(2)} USD reaches your account.`
      : `Minimum transfer to connected account is $${MIN_BANK_PAYOUT_CENTS / 100}.`;
  }
  return null;
}
