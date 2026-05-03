/**
 * Arcade credit packs (USD → prize_credits). Server validates `id` in Edge Functions.
 * Tune prices with your economy; keep in sync with `createWhopCheckoutSession` package map.
 */
export type CreditPackage = {
  id: string;
  label: string;
  /** Price charged in USD cents */
  priceCents: number;
  /** Credits granted to `profiles.prize_credits` */
  prizeCredits: number;
  /** Optional badge for UI */
  tag?: string;
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'credits_500', label: 'Starter', priceCents: 499, prizeCredits: 500 },
  { id: 'credits_1200', label: 'Value', priceCents: 999, prizeCredits: 1200, tag: 'Popular' },
  { id: 'credits_3000', label: 'Power', priceCents: 1999, prizeCredits: 3000 },
  { id: 'credits_8000', label: 'Pro', priceCents: 4999, prizeCredits: 8000, tag: 'Best value' },
];

export function getCreditPackageById(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}
