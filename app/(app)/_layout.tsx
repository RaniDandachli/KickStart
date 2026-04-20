import * as Notifications from 'expo-notifications';
import { type Href, Redirect, Slot, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { ALLOW_GUEST_MODE } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { useRealtimeScaffold } from '@/hooks/useRealtimeScaffold';
import { useSyncSignupCountry } from '@/hooks/useSyncSignupCountry';
import { useSupabaseCacheSync } from '@/hooks/useSupabaseCacheSync';
import { OpenSlotInAppBanner } from '@/components/notifications/OpenSlotInAppBanner';
import { isWebPushConfigured, registerWebPushForUser } from '@/lib/webPushRegister';
import { useAuthStore } from '@/store/authStore';

function navigateFromNotificationData(router: ReturnType<typeof useRouter>, data: Record<string, unknown>): void {
  const href = data.href;
  if (typeof href === 'string' && href.length > 0) {
    router.push(href as Href);
  }
}

export default function AuthenticatedLayout() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);
  const user = useAuthStore((s) => s.user);
  const profileQ = useProfile(Platform.OS === 'web' && userId && userId !== 'guest' ? userId : undefined);
  const router = useRouter();
  const handledColdStartNotification = useRef(false);
  const webPushSyncKeyRef = useRef<string | null>(null);

  useRealtimeScaffold(userId);
  useSupabaseCacheSync(userId);
  useSyncSignupCountry(user);

  useEffect(() => {
    if (ALLOW_GUEST_MODE) return;
    if (Platform.OS === 'web') return;
    if (status === 'signedOut') {
      router.replace('/(auth)/sign-in');
    }
  }, [router, status]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      navigateFromNotificationData(router, data);
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (Platform.OS === 'web' || handledColdStartNotification.current) return;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || handledColdStartNotification.current) return;
      handledColdStartNotification.current = true;
      const data = response.notification.request.content.data as Record<string, unknown>;
      navigateFromNotificationData(router, data);
    });
  }, [router]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!userId || userId === 'guest') return;
    if (!isWebPushConfigured()) return;
    const p = profileQ.data;
    if (!p || p.push_notify_h2h_open_slots !== true) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return;

    const watchFingerprint = JSON.stringify(p.h2h_open_slot_watch ?? null);
    const syncKey = `${userId}:${watchFingerprint}`;
    if (webPushSyncKeyRef.current === syncKey) return;
    webPushSyncKeyRef.current = syncKey;

    void registerWebPushForUser().then((res) => {
      if (!res.ok) {
        console.warn('[webPush] auto-sync failed', res.error);
      }
    });
  }, [profileQ.data, userId]);

  if (!ALLOW_GUEST_MODE && status === 'loading') return null;

  if (!ALLOW_GUEST_MODE && status === 'signedOut' && Platform.OS !== 'web') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <OpenSlotInAppBanner />
      <Slot />
    </View>
  );
}
