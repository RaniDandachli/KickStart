import { Linking } from 'react-native';

import { router } from 'expo-router';

import { env } from '@/lib/env';

/** Bump when in-app or hosted Terms/Privacy documents change materially (stored on sign-up for audit). */
export const TERMS_PRIVACY_DOC_VERSION = '2026-04-15';

async function tryOpenExternal(url: string | undefined): Promise<boolean> {
  const u = url?.trim();
  if (!u) return false;
  const ok = await Linking.canOpenURL(u);
  if (!ok) return false;
  await Linking.openURL(u);
  return true;
}

/** Opens hosted URL if EXPO_PUBLIC_TERMS_URL is set; otherwise the in-app Terms screen. */
export async function openTermsOfService(): Promise<void> {
  const opened = await tryOpenExternal(env.EXPO_PUBLIC_TERMS_URL);
  if (opened) return;
  router.push('/terms-of-service');
}

/** Opens hosted URL if EXPO_PUBLIC_PRIVACY_URL is set; otherwise the in-app Privacy screen. */
export async function openPrivacyPolicy(): Promise<void> {
  const opened = await tryOpenExternal(env.EXPO_PUBLIC_PRIVACY_URL);
  if (opened) return;
  router.push('/privacy-policy');
}
