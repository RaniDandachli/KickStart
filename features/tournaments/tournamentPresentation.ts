import type { EntryType, TournamentFormat, TournamentState } from '@/types/database';
import { formatUsdFromCents } from '@/lib/money';

/** Cash tournaments: fee is deducted from `wallet_cents`, not prize credits. */
export function formatTournamentWalletEntry(entryType: EntryType, feeWalletCents: number): string {
  if (entryType === 'credits') {
    return feeWalletCents > 0 ? `${formatUsdFromCents(feeWalletCents)} from cash wallet` : 'Free entry';
  }
  return formatEntryType(entryType);
}

export function formatTournamentState(state: TournamentState): string {
  const labels: Record<TournamentState, string> = {
    draft: 'Draft',
    open: 'Open',
    full: 'Full',
    locked: 'Locked',
    active: 'Live',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[state];
}

export function formatEntryType(t: EntryType): string {
  const labels: Record<EntryType, string> = {
    free: 'Free entry',
    credits: 'Cash wallet',
    sponsor: 'Sponsor funded',
  };
  return labels[t];
}

export function formatFormat(f: TournamentFormat): string {
  return f === 'single_elimination' ? 'Single elimination' : 'Round robin (placeholder)';
}
