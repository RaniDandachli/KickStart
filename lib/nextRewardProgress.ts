import type { PrizeCatalogRow } from '@/types/database';

export type NextRewardTarget = {
  /** Catalog prize title (e.g. "$25 Amazon gift card"). */
  title: string;
  cost: number;
  percent: number;
  ticketsToGo: number;
  /** True when every catalog item costs no more than balance (and catalog non-empty). */
  allAffordable: boolean;
};

function isEligible(p: PrizeCatalogRow): boolean {
  if (!p.is_active) return false;
  if (p.stock_remaining != null && p.stock_remaining <= 0) return false;
  return true;
}

/**
 * Next prize to "grind" toward: cheapest eligible row with cost > balance.
 * If none, user can afford everything — still returns the priciest title at 100%.
 */
export function getNextRewardTarget(
  balance: number,
  catalog: PrizeCatalogRow[] | undefined | null,
  demoFallback?: { cost: number; title: string },
): NextRewardTarget | null {
  const items = [...(catalog ?? []).filter(isEligible)].sort((a, b) => {
    if (a.cost_redeem_tickets !== b.cost_redeem_tickets) return a.cost_redeem_tickets - b.cost_redeem_tickets;
    return a.sort_order - b.sort_order;
  });

  if (items.length === 0) {
    if (!demoFallback) return null;
    const cost = Math.max(1, demoFallback.cost);
    const percent = Math.min(100, Math.floor((balance / cost) * 100));
    return {
      title: demoFallback.title,
      cost,
      percent,
      ticketsToGo: Math.max(0, cost - balance),
      allAffordable: balance >= cost,
    };
  }

  const next = items.find((p) => p.cost_redeem_tickets > balance);
  if (next) {
    const cost = next.cost_redeem_tickets;
    const percent = Math.min(100, Math.floor((balance / cost) * 100));
    return {
      title: next.title,
      cost,
      percent,
      ticketsToGo: Math.max(0, cost - balance),
      allAffordable: false,
    };
  }

  const last = items[items.length - 1];
  return {
    title: last.title,
    cost: last.cost_redeem_tickets,
    percent: 100,
    ticketsToGo: 0,
    allAffordable: true,
  };
}
