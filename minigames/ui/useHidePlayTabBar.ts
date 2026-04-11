import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { InteractionManager, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  findBottomTabNavigator,
  getHiddenTabBarStyle,
  getRestoredTabBarStyle,
  type TabBarSafeInsets,
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
  const insetsRef = useRef<TabBarSafeInsets>({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  });
  insetsRef.current = {
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  };

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
    const tabs = getTabsNavigator(navigation as NavigationProp<ParamListBase>);
    tabs?.setOptions({
      tabBarStyle: getHiddenTabBarStyle(),
    });
    return () => {
      const t = tabs;
      if (!t) return;
      const apply = () => {
        t.setOptions({
          tabBarStyle: getRestoredTabBarStyle(insetsRef.current),
        });
      };
      // Defer one frame after work + orientation settles so bottom inset / layout match portrait (avoids floating tab bar).
      if (Platform.OS === 'web') {
        apply();
        return;
      }
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(apply);
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
  const insetsRef = useRef<TabBarSafeInsets>({
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  });
  insetsRef.current = {
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  };

  useFocusEffect(
    useCallback(() => {
      const tabs = getTabsNavigator(navigation as NavigationProp<ParamListBase>);
      tabs?.setOptions({
        tabBarStyle: getRestoredTabBarStyle(insetsRef.current),
      });
    }, [navigation])
  );
}
