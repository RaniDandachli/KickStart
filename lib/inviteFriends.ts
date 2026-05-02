import { Alert, Platform, Share } from 'react-native';

import { STRIPE_CONNECT_PUBLIC_ORIGIN } from '@/lib/stripeConnectUrls';

/** Public landing URL — same origin family as Stripe Connect deep links. */
export function buildAppInviteUrl(referrerUserId?: string): string {
  const base = STRIPE_CONNECT_PUBLIC_ORIGIN.replace(/\/$/, '');
  if (!referrerUserId) return `${base}/`;
  return `${base}/?ref=${encodeURIComponent(referrerUserId)}`;
}

function buildInviteMessage(url: string): string {
  return `Come play skill contests with me on Run It Arcade — neon minigames & head-to-head matches.\n${url}`;
}

async function copyInviteWebFallback(fullMessage: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(fullMessage);
      Alert.alert('Copied', 'Invite message copied — paste it to a friend.');
      return;
    }
  } catch {
    /* fall through */
  }
  Alert.alert('Invite a friend', fullMessage);
}

/**
 * Opens the native share sheet (mobile) or Web Share API / clipboard (web).
 */
export async function shareAppInvite(referrerUserId?: string): Promise<void> {
  const url = buildAppInviteUrl(referrerUserId);
  const message = buildInviteMessage(url);

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Run It Arcade',
          text: 'Come play skill contests with me on Run It Arcade.',
          url,
        });
        return;
      } catch (e: unknown) {
        const name = e && typeof e === 'object' && 'name' in e ? String((e as Error).name) : '';
        if (name === 'AbortError') return;
      }
    }
    await copyInviteWebFallback(message);
    return;
  }

  try {
    await Share.share(
      Platform.OS === 'ios'
        ? { url, message: 'Come play skill contests with me on Run It Arcade' }
        : { message, title: 'Run It Arcade' },
    );
  } catch {
    /* dismissed */
  }
}
