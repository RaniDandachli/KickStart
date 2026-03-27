import type { EntryType, TournamentFormat, TournamentState } from '@/types/database';

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
    credits: 'Credits',
    sponsor: 'Sponsor funded',
  };
  return labels[t];
}

export function formatFormat(f: TournamentFormat): string {
  return f === 'single_elimination' ? 'Single elimination' : 'Round robin (placeholder)';
}
