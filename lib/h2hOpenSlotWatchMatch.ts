/**
 * Same rules as `h2hOpenMatchWatchScan` (`watchMatchesRow`) — keep in sync when server filter changes.
 */
export type OpenSlotWatchJson = {
  enabled?: boolean;
  entryCents?: number[];
  gameKeys?: string[] | null;
};

export type OpenSlotWaiterRow = {
  game_key: string | null;
  entry_fee_wallet_cents: number | null;
};

export function openSlotWatchMatchesWaiterRow(waiter: OpenSlotWaiterRow, raw: unknown): boolean {
  const w = raw as OpenSlotWatchJson;
  if (!w || w.enabled !== true) return false;
  const ec = Math.max(0, Math.floor(Number(waiter.entry_fee_wallet_cents ?? 0)));
  const tiers = Array.isArray(w.entryCents) ? w.entryCents.map((x) => Math.floor(Number(x))) : [];
  if (tiers.length > 0 && !tiers.includes(ec)) return false;
  const gk = (waiter.game_key ?? '').trim();
  const games = w.gameKeys;
  if (games != null && games.length > 0) {
    if (!gk || !games.includes(gk)) return false;
  }
  return true;
}
