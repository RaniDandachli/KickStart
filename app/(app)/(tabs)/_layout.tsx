import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { applyArcadePrizeCreditGrants } from '@/lib/arcadeGrants';
import { getDefaultTabBarStyle } from '@/lib/tabBarStyle';
import { useArcadeGrantBannerStore } from '@/store/arcadeGrantBannerStore';

const ICON = 20;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const grantsRan = useRef(false);

  useEffect(() => {
    if (grantsRan.current) return;
    grantsRan.current = true;
    void applyArcadePrizeCreditGrants().then(({ welcome, daily }) => {
      if (welcome > 0 || daily > 0) {
        useArcadeGrantBannerStore.getState().setGrants(welcome, daily);
      }
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Turbo Arena locks landscape in-screen until unmount; don't fight it here.
    if (pathname.includes('turbo-arena') || pathname.includes('neon-pool')) return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, [pathname]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: getDefaultTabBarStyle(insets.bottom),
        tabBarActiveTintColor: '#ff006e',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontWeight: '800',
          fontSize: 10,
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarIconStyle: { marginTop: 0 },
        tabBarItemStyle: {
          paddingVertical: 4,
          justifyContent: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => <Ionicons name="trophy" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'Arcade',
          tabBarIcon: ({ color }) => <Ionicons name="game-controller" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="prizes"
        options={{
          title: 'Prizes',
          tabBarIcon: ({ color }) => <Ionicons name="gift" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <Ionicons name="person" color={color} size={ICON} />,
        }}
      />
    </Tabs>
  );
}
