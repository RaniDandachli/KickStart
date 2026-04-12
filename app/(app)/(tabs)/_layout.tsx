import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Tabs, usePathname } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { WebBrowseAuthBar } from '@/components/WebBrowseAuthBar';
import { FirstRunTabTour } from '@/components/onboarding/FirstRunTabTour';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import {
  ensureArcadeNotificationPermissionAndSchedule,
  presentDailyCreditsGrantedIfEnabled,
  refreshArcadeScheduledNotifications,
} from '@/lib/arcadeLocalNotifications';
import { applyArcadePrizeCreditGrants, resetArcadeGrantFlight } from '@/lib/arcadeGrants';
import { registerExpoPushWithSupabase } from '@/lib/expoPushRegistration';
import { useWebUsesTopTabBar } from '@/hooks/useWebUsesTopTabBar';
import { getHasCompletedTabTour } from '@/lib/onboardingStorage';
import { getAppTabBarStyle } from '@/lib/tabBarStyle';
import { useArcadeGrantBannerStore } from '@/store/arcadeGrantBannerStore';
import { useAuthStore } from '@/store/authStore';
import { getSupabase } from '@/supabase/client';

const ICON = 20;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id);
  const authStatus = useAuthStore((s) => s.status);
  const webUsesTopTabBar = useWebUsesTopTabBar();
  const webBrowseAuth = Platform.OS === 'web' && authStatus === 'signedOut';
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
    if (Platform.OS === 'web') return;
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
    <WebBrowseAuthBar />
    <Tabs
      screenOptions={{
        headerShown: false,
        /** Icon on top, title under (Home, Events, Arcade, …) — all platforms / web widths */
        tabBarLabelPosition: 'below-icon',
        ...(Platform.OS === 'web' && webUsesTopTabBar
          ? {
              tabBarPosition: 'top' as const,
              /** Top bar must not use `material` — RN only allows that for left/right side tabs. */
              tabBarVariant: 'uikit' as const,
              sceneStyle: {
                maxWidth: 1280,
                width: '100%' as const,
                alignSelf: 'center' as const,
              },
            }
          : {}),
        tabBarStyle: {
          ...getAppTabBarStyle(
            {
              top: insets.top,
              bottom: insets.bottom,
              left: insets.left,
              right: insets.right,
            },
            Platform.OS === 'web'
              ? { webTopBar: webUsesTopTabBar, webMobileBottom: !webUsesTopTabBar }
              : undefined,
          ),
          ...(webBrowseAuth && webUsesTopTabBar ? { paddingRight: Math.max(insets.right, 16) + 168 } : {}),
        },
        tabBarActiveTintColor: '#ff006e',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarShowLabel: true,
        tabBarLabelStyle:
          Platform.OS === 'web' && webUsesTopTabBar
            ? {
                fontWeight: '700',
                fontSize: 11,
                marginTop: 2,
                marginBottom: 0,
              }
            : Platform.OS === 'web'
              ? {
                  fontWeight: '700',
                  fontSize: 11,
                  letterSpacing: 0.1,
                  marginTop: 3,
                  marginBottom: 0,
                }
              : {
                  fontWeight: '800',
                  fontSize: 10,
                  marginTop: 4,
                  marginBottom: 0,
                },
        tabBarIconStyle:
          Platform.OS === 'web' && webUsesTopTabBar
            ? { marginTop: 4, marginBottom: 0, marginRight: 0 }
            : Platform.OS === 'web'
              ? { marginTop: 0, marginBottom: 0 }
              : { marginTop: 2, marginBottom: 0 },
        tabBarItemStyle: {
          paddingVertical:
            Platform.OS === 'web' && webUsesTopTabBar ? 10 : Platform.OS === 'web' ? 6 : 5,
          justifyContent: 'center',
          ...(Platform.OS === 'web' && !webUsesTopTabBar
            ? { alignItems: 'center' as const, flex: 1, minWidth: 0 }
            : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <SafeIonicons name="home" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: 'Events',
          tabBarLabel: 'Events',
          tabBarIcon: ({ color }) => <SafeIonicons name="trophy" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'Arcade',
          tabBarLabel: 'Arcade',
          tabBarIcon: ({ color }) => <SafeIonicons name="game-controller" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="prizes"
        options={{
          title: 'Prizes',
          tabBarLabel: 'Prizes',
          tabBarIcon: ({ color }) => <SafeIonicons name="gift" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarLabel: 'You',
          tabBarIcon: ({ color }) => <SafeIonicons name="person" color={color} size={ICON} />,
        }}
      />
    </Tabs>
    {showFirstRunTour ? (
      <FirstRunTabTour onFinished={() => setShowFirstRunTour(false)} />
    ) : null}
    </>
  );
}
