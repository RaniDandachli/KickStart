import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Tabs, usePathname } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { WebBrowseAuthBar } from '@/components/WebBrowseAuthBar';
import { WebAppBrandLogo, WEB_TOP_LOGO_SLOT_PX } from '@/components/web/WebAppBrandLogo';
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
import { webTabBarLabelRenderer } from '@/lib/webTabBarLabel';
import { useArcadeGrantBannerStore } from '@/store/arcadeGrantBannerStore';
import { useAuthStore } from '@/store/authStore';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';

type IonName = ComponentProps<typeof SafeIonicons>['name'];

const NATIVE_TAB_ICON = 20;
/** Web: use SafeIonicons (SVG glyphs) — Ionicon font often paints as empty squares in the tab bar. */
const WEB_TAB_ICON = 22;

function tabBarIcon(name: IonName) {
  const size = Platform.OS === 'web' ? WEB_TAB_ICON : NATIVE_TAB_ICON;
  return ({ color }: { color: string }) => <SafeIonicons name={name} color={color} size={size} />;
}

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
        const { error } = await invokeEdgeFunction('notifyDailyCreditsPush', { body: {} });
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
    <WebAppBrandLogo />
    <Tabs
      screenOptions={{
        headerShown: false,
        /**
         * Web desktop: label beside icon (readable strip). Narrow web: label under icon.
         * Native: label under icon. Per-screen `tabBarLabel` strings override a custom renderer — omit on web.
         */
        tabBarLabelPosition:
          Platform.OS === 'web' && webUsesTopTabBar ? 'beside-icon' : 'below-icon',
        ...(Platform.OS === 'web'
          ? {
              tabBarLabel: webTabBarLabelRenderer,
            }
          : {}),
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
          ...(Platform.OS === 'web' && webUsesTopTabBar
            ? { paddingLeft: Math.max(insets.left, 16) + WEB_TOP_LOGO_SLOT_PX }
            : {}),
        },
        tabBarActiveTintColor: '#ff006e',
        tabBarInactiveTintColor: '#CBD5E1',
        tabBarShowLabel: true,
        /** RN `Label` only (native); web uses {@link webTabBarLabelRenderer}. */
        tabBarLabelStyle:
          Platform.OS === 'web'
            ? undefined
            : {
                fontWeight: '800',
                fontSize: 10,
                marginTop: 4,
                marginBottom: 0,
              },
        tabBarIconStyle:
          Platform.OS === 'web' && webUsesTopTabBar
            ? { marginTop: 2, marginBottom: 0, marginRight: 0 }
            : Platform.OS === 'web'
              ? { marginTop: 0, marginBottom: 2 }
              : { marginTop: 2, marginBottom: 0 },
        tabBarItemStyle: {
          paddingVertical:
            Platform.OS === 'web' && webUsesTopTabBar ? 10 : Platform.OS === 'web' ? 8 : 5,
          justifyContent: 'center',
          ...(Platform.OS === 'web' && webUsesTopTabBar ? { paddingHorizontal: 6 } : {}),
          ...(Platform.OS === 'web' && !webUsesTopTabBar
            ? {
                alignItems: 'center' as const,
                flex: 1,
                minWidth: 0,
                overflow: 'visible' as const,
              }
            : {}),
        },
      } as BottomTabNavigationOptions}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabBarIcon('home'),
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: 'Events',
          tabBarIcon: tabBarIcon('trophy'),
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'Arcade',
          tabBarIcon: tabBarIcon('game-controller'),
        }}
      />
      <Tabs.Screen
        name="prizes"
        options={{
          title: 'Prizes',
          tabBarIcon: tabBarIcon('gift'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: tabBarIcon('person'),
        }}
      />
    </Tabs>
    {showFirstRunTour ? (
      <FirstRunTabTour onFinished={() => setShowFirstRunTour(false)} />
    ) : null}
    </>
  );
}
