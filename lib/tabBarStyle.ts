import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { Platform } from 'react-native';

import { runit } from '@/lib/runitArcadeTheme';

export type TabBarSafeInsets = { top: number; bottom: number; left?: number; right?: number };

export type AppTabBarOptions = {
  /** Desktop-width web only: top tab strip. Narrow web uses the same bottom bar as native. */
  webTopBar?: boolean;
  /** iPhone Safari / narrow web: floating glass bar, room for labels above browser chrome. */
  webMobileBottom?: boolean;
};

/**
 * Tab bar chrome. Native + narrow web: bottom tabs. Desktop web: top tab strip.
 */
export function getAppTabBarStyle(insets: TabBarSafeInsets, opts?: AppTabBarOptions) {
  const useWebTopChrome = Platform.OS === 'web' && opts?.webTopBar === true;
  if (useWebTopChrome) {
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

  const webMobileBottom = Platform.OS === 'web' && opts?.webMobileBottom === true;
  if (webMobileBottom) {
    const safeBottom = Math.max(insets.bottom, 22);
    return {
      backgroundColor: 'rgba(5, 2, 14, 0.76)',
      borderTopWidth: 0,
      borderWidth: 1,
      borderColor: 'rgba(157, 78, 237, 0.4)',
      borderRadius: 22,
      marginHorizontal: 12,
      marginBottom: 10,
      marginTop: 4,
      paddingTop: 6,
      paddingBottom: 8 + safeBottom,
      paddingHorizontal: 2,
      minHeight: 64 + Math.min(safeBottom, 8) * 0.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 18,
      elevation: 20,
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
export function getRestoredTabBarStyle(insets: TabBarSafeInsets, webTopBar?: boolean) {
  const wt = webTopBar ?? false;
  return {
    ...getAppTabBarStyle(
      insets,
      Platform.OS === 'web' ? { webTopBar: wt, webMobileBottom: !wt } : undefined,
    ),
    display: 'flex' as const,
    opacity: 1,
  };
}

/**
 * Walks parent navigators until the bottom-tab navigator is found (TabRouter state type is `tab`).
 * More reliable than assuming a fixed depth (play stack vs nested routes).
 */
export function findBottomTabNavigator(
  nav: NavigationProp<ParamListBase> | undefined,
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
