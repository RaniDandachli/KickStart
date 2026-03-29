import { useNavigation } from 'expo-router';
import { useLayoutEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDefaultTabBarStyle, getHiddenTabBarStyle } from '@/lib/tabBarStyle';

/** Hides bottom tab bar while a full-screen mini-game is active. Restores full safe-area padding on exit. */
export function useHidePlayTabBar(): void {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const bottomInsetRef = useRef(insets.bottom);
  bottomInsetRef.current = insets.bottom;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
    const stack = navigation.getParent();
    const tabs = stack?.getParent() ?? stack;
    tabs?.setOptions({
      tabBarStyle: getHiddenTabBarStyle(),
    });
    return () => {
      tabs?.setOptions({
        tabBarStyle: {
          ...getDefaultTabBarStyle(bottomInsetRef.current),
          display: 'flex',
          opacity: 1,
        },
      });
    };
  }, [navigation]);
}
