import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { Platform } from 'react-native';

import { appTabBarBorderAccent, runit } from '@/lib/runitArcadeTheme';

/** Desktop web top tab row height — exported so the corner logo aligns vertically. */
export const WEB_TOP_TAB_BAR_ROW_HEIGHT_PX = 44;

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
    /** Slim strip: same tone as page shows through (body / scene) — not a separate “dock”. */
    const padTop = Math.max(insets.top, 8) + 2;
    const padBottom = 8;
    const contentIconAndLabel = WEB_TOP_TAB_BAR_ROW_HEIGHT_PX;
    return {
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      borderBottomWidth: 0,
      paddingTop: padTop,
      paddingBottom: padBottom,
      paddingHorizontal: padH,
      height: padTop + contentIconAndLabel + padBottom,
      minHeight: padTop + contentIconAndLabel + padBottom,
      overflow: 'visible' as const,
    };
  }

  const webMobileBottom = Platform.OS === 'web' && opts?.webMobileBottom === true;
  if (webMobileBottom) {
    const safeBottom = Math.max(insets.bottom, 22);
    /**
     * RN BottomTabBar sets a fixed `height` (~49px + inset) which clips labels under icons.
     * Our style merges last — set an explicit tall `height` so icon + title fit (iPhone Safari web).
     */
    const padTop = 10;
    const padBottom = 12 + safeBottom;
    /** Icon + 1–2 lines of label on narrow mobile web (Safari). */
    const contentForIconAndLabel = 72;
    return {
      backgroundColor: 'rgba(5, 2, 14, 0.76)',
      borderTopWidth: 0,
      borderWidth: 1,
      borderColor: appTabBarBorderAccent,
      borderRadius: 22,
      marginHorizontal: 12,
      marginBottom: 10,
      marginTop: 4,
      paddingTop: padTop,
      paddingBottom: padBottom,
      paddingHorizontal: 2,
      height: padTop + contentForIconAndLabel + padBottom,
      minHeight: padTop + contentForIconAndLabel + padBottom,
      overflow: 'visible',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 18,
      elevation: 20,
    };
  }

  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 12) + 2;
  const padTop = 8;
  /** Same as web: default tab bar height (~49px + inset) hides labels under icons without explicit `height`. */
  const contentIconAndLabel = 52;
  return {
    backgroundColor: runit.bgDeep,
    borderTopWidth: 2,
    borderTopColor: appTabBarBorderAccent,
    paddingTop: padTop,
    paddingBottom: bottomPad,
    paddingHorizontal: 6,
    height: padTop + contentIconAndLabel + bottomPad,
    overflow: 'visible' as const,
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
