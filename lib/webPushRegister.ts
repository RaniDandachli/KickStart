/**
 * Web Push (browser) — register service worker + subscribe + POST to Edge.
 * Requires HTTPS (or localhost). VAPID public key in `EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`.
 */
import { Platform } from 'react-native';

import { env } from '@/lib/env';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = globalThis.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isWebPushConfigured(): boolean {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && !!env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (e) {
    console.warn('[webPush] register sw failed', e);
    return null;
  }
}

/**
 * Subscribe this browser and save keys to Supabase (signed-in user).
 */
export async function registerWebPushForUser(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (Platform.OS !== 'web') return { ok: false, error: 'Not web' };
  const vapid = env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  if (!vapid) return { ok: false, error: 'Web Push is not configured (EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY).' };

  if (typeof Notification === 'undefined') {
    return { ok: false, error: 'Notifications are not supported in this browser.' };
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return { ok: false, error: 'Notification permission was not granted.' };
  }

  const reg = await getRegistration();
  if (!reg) return { ok: false, error: 'Could not register the service worker.' };

  await reg.update();

  let sub: PushSubscription | null = null;
  try {
    const applicationServerKey = urlBase64ToUint8Array(vapid) as BufferSource;
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Push subscription failed' };
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: 'Invalid push subscription from browser.' };
  }

  const { error } = await invokeEdgeFunction('registerWebPushSubscription', {
    body: {
      subscription: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      },
    },
  });
  if (error) return { ok: false, error: error instanceof Error ? error.message : 'Could not save subscription' };
  return { ok: true };
}

/** Remove this browser’s subscription from Supabase and unsubscribe locally. */
export async function unregisterWebPushForUser(): Promise<void> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    const endpoint = sub?.endpoint;
    if (sub) await sub.unsubscribe();
    if (endpoint) {
      await invokeEdgeFunction('registerWebPushSubscription', {
        body: { deleteEndpoint: endpoint },
      });
    }
  } catch {
    /* ignore */
  }
}
