/**
 * Web Push (VAPID) for browsers — used by h2hOpenMatchWatchScan.
 * Secrets: WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, optional WEB_PUSH_CONTACT (mailto:…).
 */
// deno-lint-ignore no-import-prefix
import webpush from 'npm:web-push@3.6.7';

export type WebPushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;

function ensureVapid(): { ok: true } | { ok: false; error: string } {
  if (vapidConfigured) return { ok: true };
  const publicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')?.trim();
  const privateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')?.trim();
  const subject = Deno.env.get('WEB_PUSH_CONTACT')?.trim() || 'mailto:support@runitarcade.app';
  if (!publicKey || !privateKey) {
    return { ok: false, error: 'Web Push VAPID keys not configured (WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY)' };
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return { ok: true };
}

export async function sendWebPushToSubscription(
  sub: WebPushSubscriptionRow,
  payload: { title: string; body: string; url: string },
): Promise<{ ok: true } | { ok: false; error: string; statusCode?: number }> {
  const v = ensureVapid();
  if (!v.ok) return v;

  const pushSub = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };

  const body = JSON.stringify(payload);

  try {
    // deno-lint-ignore no-explicit-any
    await webpush.sendNotification(pushSub as any, body, {
      TTL: 120,
      urgency: 'high',
      headers: {},
    });
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string; body?: string };
    const msg = err?.message ?? String(e);
    console.warn('[webPushSend]', err?.statusCode, msg.slice(0, 200), err?.body?.slice?.(0, 120));
    return { ok: false, error: msg.slice(0, 400), statusCode: err?.statusCode };
  }
}
