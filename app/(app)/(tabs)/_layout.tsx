import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { FirstRunTabTour } from '@/components/onboarding/FirstRunTabTour';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import {
  ensureArcadeNotificationPermissionAndSchedule,
  presentDailyCreditsGrantedIfEnabled,
  refreshArcadeScheduledNotifications,
} from '@/lib/arcadeLocalNotifications';
import { applyArcadePrizeCreditGrants, resetArcadeGrantFlight } from '@/lib/arcadeGrants';
import { registerExpoPushWithSupabase } from '@/lib/expoPushRegistration';
import { getHasCompletedTabTour } from '@/lib/onboardingStorage';
import { getDefaultTabBarStyle } from '@/lib/tabBarStyle';
import { useArcadeGrantBannerStore } from '@/store/arcadeGrantBannerStore';
import { useAuthStore } from '@/store/authStore';
import { getSupabase } from '@/supabase/client';

const ICON = 20;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id);
  const lastGrantUid = useRef<string | null>(null);
  const [showFirstRunTour, setShowFirstRunTour] = useState(false);

  useEffect(() => {
    if (!uid) {
      lastGrantUid.current = null;
      return;
    }
    if (lastGrantUid.current !== uid) {
      resetArcadeGrantFlight();
      lastGrantUid.current = uid;
    }
    void applyArcadePrizeCreditGrants(queryClient).then(async ({ welcome, daily }) => {
      if (welcome > 0 || daily > 0) {
        useArcadeGrantBannerStore.getState().setGrants(welcome, daily);
      }
      if (daily > 0 && ENABLE_BACKEND && Platform.OS !== 'web') {
        await registerExpoPushWithSupabase(uid);
        const { error } = await getSupabase().functions.invoke('notifyDailyCreditsPush', { body: {} });
        if (error) console.warn('[notifyDailyCreditsPush]', error.message);
      }
      if (daily > 0) {
        void presentDailyCreditsGrantedIfEnabled();
      }
    });
  }, [uid, queryClient]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void (async () => {
      await ensureArcadeNotificationPermissionAndSchedule();
      if (uid && ENABLE_BACKEND) {
        await registerExpoPushWithSupabase(uid);
      }
      await refreshArcadeScheduledNotifications();
    })();
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const done = await getHasCompletedTabTour();
      if (!cancelled && !done) setShowFirstRunTour(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // These routes set their own orientation until blur; don't fight them here.
    if (
      pathname.includes('turbo-arena') ||
      pathname.includes('neon-pool') ||
      pathname.includes('dash-duel') ||
      pathname.includes('play/match')
    ) {
      return;
    }
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, [pathname]);

  return (
    <>
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
    {showFirstRunTour ? (
      <FirstRunTabTour onFinished={() => setShowFirstRunTour(false)} />
    ) : null}
    </>
  );
}
