import { Platform } from 'react-native';

import { runit } from '@/lib/runitArcadeTheme';

/**
 * Single source of truth for the bottom tab bar look + safe-area padding.
 * Used by the tabs layout and when restoring after full-screen games hide the bar.
 */
export function getDefaultTabBarStyle(bottomInset: number) {
  const bottomPad = Math.max(bottomInset, Platform.OS === 'ios' ? 14 : 12) + 2;
  return {
    backgroundColor: runit.bgDeep,
    borderTopWidth: 2,
    borderTopColor: 'rgba(157, 78, 237, 0.45)',
    paddingTop: 8,
    paddingBottom: bottomPad,
    paddingHorizontal: 6,
  };
}

/** Hide tab bar without leaving stale height/padding when we restore defaults. */
export function getHiddenTabBarStyle() {
  return {
    display: 'none' as const,
    height: 0,
    opacity: 0,
  };
}
