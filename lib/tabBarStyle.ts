import type { NavigationProp, ParamListBase } from '@react-navigation/native';
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

/** After hiding, restore visible tab bar (explicit display/opacity so nothing stays stuck hidden). */
export function getRestoredTabBarStyle(bottomInset: number) {
  return {
    ...getDefaultTabBarStyle(bottomInset),
    display: 'flex' as const,
    opacity: 1,
  };
}

/**
 * Walks parent navigators until the bottom-tab navigator is found (TabRouter state type is `tab`).
 * More reliable than assuming a fixed depth (play stack vs nested routes).
 */
export function findBottomTabNavigator(
  nav: NavigationProp<ParamListBase> | undefined
): NavigationProp<ParamListBase> | undefined {
  let current: NavigationProp<ParamListBase> | undefined = nav;
  for (let i = 0; i < 16; i++) {
    if (!current) break;
    const state = current.getState?.() as { type?: string } | undefined;
    if (state?.type === 'tab') {
      return current;
    }
    current = current.getParent?.() as NavigationProp<ParamListBase> | undefined;
  }
  return undefined;
}
