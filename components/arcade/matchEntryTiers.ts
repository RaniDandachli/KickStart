import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

/** Demo tier list: entry fee (USD) and listed prize for head-to-head skill matches. */
export type MatchEntryTier = {
  entry: number;
  prize: number;
  icon: ComponentProps<typeof Ionicons>['name'];
  shortLabel: string;
};

export const MATCH_ENTRY_TIERS: readonly MatchEntryTier[] = [
  { entry: 1, prize: 2, icon: 'flash-outline', shortLabel: 'Starter' },
  { entry: 5, prize: 9, icon: 'flame-outline', shortLabel: 'Casual' },
  { entry: 10, prize: 19, icon: 'trending-up-outline', shortLabel: 'Rising' },
  { entry: 20, prize: 38, icon: 'ribbon-outline', shortLabel: 'Pro' },
  { entry: 50, prize: 95, icon: 'diamond-outline', shortLabel: 'Elite' },
  { entry: 100, prize: 190, icon: 'star-outline', shortLabel: 'Legend' },
];
