import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  findBottomTabNavigator,
  getHiddenTabBarStyle,
  getRestoredTabBarStyle,
} from '@/lib/tabBarStyle';

function getTabsNavigator(navigation: NavigationProp<ParamListBase>): NavigationProp<ParamListBase> | undefined {
  return (
    findBottomTabNavigator(navigation) ??
    (() => {
      const stack = navigation.getParent();
      return (stack?.getParent() ?? stack) as NavigationProp<ParamListBase> | undefined;
    })()
  );
}

/** Hides bottom tab bar while a full-screen mini-game is active. Restores full safe-area padding on exit. */
export function useHidePlayTabBar(): void {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const bottomInsetRef = useRef(insets.bottom);
  bottomInsetRef.current = insets.bottom;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
    const tabs = getTabsNavigator(navigation as NavigationProp<ParamListBase>);
    tabs?.setOptions({
      tabBarStyle: getHiddenTabBarStyle(),
    });
    return () => {
      tabs?.setOptions({
        tabBarStyle: getRestoredTabBarStyle(bottomInsetRef.current),
      });
    };
  }, [navigation]);
}

/**
 * When Play / minigames hub gains focus, force tab bar visible. Fixes cases where hide cleanup
 * ran against the wrong navigator and bottom tabs stayed hidden (no icons / feels "stuck").
 */
export function useRestoreBottomTabBarOnFocus(): void {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const bottomInsetRef = useRef(insets.bottom);
  bottomInsetRef.current = insets.bottom;

  useFocusEffect(
    useCallback(() => {
      const tabs = getTabsNavigator(navigation as NavigationProp<ParamListBase>);
      tabs?.setOptions({
        tabBarStyle: getRestoredTabBarStyle(bottomInsetRef.current),
      });
    }, [navigation])
  );
}
