import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';

/** Contest access in whole cents — must match `h2h_enqueue_quick_match` allowlist. */
export const QUICK_MATCH_KNOWN_ENTRY_CENTS = [0, 100, 500, 1000, 2000, 5000, 10000] as const;

/** Prize (USD × 100 cents) for each known contest access tier — mirrors `MATCH_ENTRY_TIERS` + free. */
export function prizeUsdCentsForContestEntryCents(entryCents: number): number {
  if (entryCents <= 0) return 0;
  const row = MATCH_ENTRY_TIERS.find((t) => Math.round(t.entry * 100) === entryCents);
  return row ? Math.round(row.prize * 100) : 0;
}

/** Labels for Quick Match tier chips ($5 / $10 / $20 style). */
export function labelForQuickMatchEntryCents(entryCents: number): string {
  if (entryCents <= 0) return 'Free casual';
  const row = MATCH_ENTRY_TIERS.find((t) => Math.round(t.entry * 100) === entryCents);
  if (row) return `$${row.entry} entry`;
  return `$${(entryCents / 100).toFixed(0)} entry`;
}

/**
 * Build sorted unique allowed entry cents, clamped to wallet and known tiers.
 * Always includes only values the server accepts.
 */
export function normalizeQuickMatchAllowedEntries(
  selected: readonly number[],
  maxAffordableEntryCents: number,
): number[] {
  const set = new Set<number>();
  for (const c of selected) {
    const n = Math.floor(Number(c));
    if (!Number.isFinite(n) || n < 0) continue;
    if (!QUICK_MATCH_KNOWN_ENTRY_CENTS.includes(n as (typeof QUICK_MATCH_KNOWN_ENTRY_CENTS)[number])) continue;
    if (n > maxAffordableEntryCents) continue;
    set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** Default “I’m OK with any tier I can afford” — callers may narrow in the UI. */
export function defaultQuickMatchAllowedSelection(maxAffordableEntryCents: number): number[] {
  const cap = Math.max(0, Math.floor(maxAffordableEntryCents));
  return QUICK_MATCH_KNOWN_ENTRY_CENTS.filter((c) => c <= cap);
}
