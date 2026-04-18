import type { H2hCarouselRow } from '@/components/arcade/HomeH2hCarouselWeb';
import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import { H2H_OPEN_GAMES, type H2hGameKey } from '@/lib/homeOpenMatches';
import { sortWaitersForDisplay, type H2hBoardWaiter } from '@/store/homeH2hBoardStore';

/** Build carousel rows (same shape as live-matches) from Supabase-backed waiters. */
export function buildHomeH2hCarouselRows(
  waiters: H2hBoardWaiter[],
  waiterIndexByGame: Partial<Record<H2hGameKey, number>> = {},
): H2hCarouselRow[] {
  return H2H_OPEN_GAMES.map((g) => {
    const forGame = sortWaitersForDisplay(waiters.filter((w) => w.gameKey === g.gameKey));
    const queueTotal = forGame.length;
    const idxRaw = waiterIndexByGame[g.gameKey] ?? 0;
    const idx = queueTotal > 0 ? ((idxRaw % queueTotal) + queueTotal) % queueTotal : 0;
    const w = queueTotal > 0 ? forGame[idx]! : null;
    const tier =
      w != null
        ? MATCH_ENTRY_TIERS[((w.tierIndex % MATCH_ENTRY_TIERS.length) + MATCH_ENTRY_TIERS.length) % MATCH_ENTRY_TIERS.length]
        : null;
    if (!w || !tier) {
      return { ...g, activeWaiter: null, queueTotal: 0, rotateIndex: 0 };
    }
    const postedMinutesAgo = Math.max(1, Math.floor((Date.now() - w.postedAt) / 60_000));
    const rotateIndex = queueTotal > 0 ? idx + 1 : 0;
    const entryUsd = w.entryFeeWalletCents != null ? w.entryFeeWalletCents / 100 : tier.entry;
    const prizeUsd = w.listedPrizeUsdCents != null ? w.listedPrizeUsdCents / 100 : tier.prize;
    return {
      ...g,
      activeWaiter: {
        id: w.id,
        tierShortLabel: tier.shortLabel,
        entryUsd,
        prizeUsd,
        hostLabel: w.hostLabel,
        postedMinutesAgo,
        entryFeeWalletCents: w.entryFeeWalletCents,
        listedPrizeUsdCents: w.listedPrizeUsdCents,
      },
      queueTotal,
      rotateIndex,
    };
  });
}
