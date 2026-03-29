import { Platform } from 'react-native';

import { arcade } from '@/lib/arcadeTheme';

/**
 * Single source of truth for the bottom tab bar look + safe-area padding.
 * Used by the tabs layout and when restoring after full-screen games hide the bar.
 */
export function getDefaultTabBarStyle(bottomInset: number) {
  const bottomPad = Math.max(bottomInset, Platform.OS === 'ios' ? 14 : 12) + 2;
  return {
    backgroundColor: arcade.navy1,
    borderTopWidth: 2,
    borderTopColor: arcade.goldBorder,
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
