import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { Platform } from 'react-native';

import { runit } from '@/lib/runitArcadeTheme';

export type TabBarSafeInsets = { top: number; bottom: number; left?: number; right?: number };

/**
 * Tab bar chrome for the current platform. Web uses a top tab bar; native uses bottom tabs.
 */
export function getAppTabBarStyle(insets: TabBarSafeInsets) {
  if (Platform.OS === 'web') {
    const padH = Math.max(insets.left ?? 0, insets.right ?? 0, 16);
    return {
      backgroundColor: runit.bgDeep,
      borderTopWidth: 0,
      borderBottomWidth: 2,
      borderBottomColor: 'rgba(157, 78, 237, 0.45)',
      paddingTop: Math.max(insets.top, 10) + 4,
      paddingBottom: 12,
      paddingHorizontal: padH,
      minHeight: 52,
    };
  }
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 12) + 2;
  return {
    backgroundColor: runit.bgDeep,
    borderTopWidth: 2,
    borderTopColor: 'rgba(157, 78, 237, 0.45)',
    paddingTop: 8,
    paddingBottom: bottomPad,
    paddingHorizontal: 6,
  };
}

/**
 * @deprecated Prefer getAppTabBarStyle — kept for call sites that only pass bottom inset (native).
 */
export function getDefaultTabBarStyle(bottomInset: number) {
  return getAppTabBarStyle({ top: 0, bottom: bottomInset });
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
export function getRestoredTabBarStyle(insets: TabBarSafeInsets) {
  return {
    ...getAppTabBarStyle(insets),
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
