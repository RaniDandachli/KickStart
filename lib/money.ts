/** Wallet / tournament amounts are stored as integer cents (100 = $1.00). */
const CENTS_PER_DOLLAR = 100;

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / CENTS_PER_DOLLAR);
}
