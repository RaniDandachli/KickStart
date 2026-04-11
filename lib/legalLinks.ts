import { Alert, Linking } from 'react-native';

import { env } from '@/lib/env';

/** Bump when hosted Terms/Privacy documents change materially (stored on sign-up for audit). */
export const TERMS_PRIVACY_DOC_VERSION = '2026-04-09';

async function openLegalUrl(url: string | undefined, label: string): Promise<void> {
  const u = url?.trim();
  if (!u) {
    Alert.alert(
      label,
      'Host your legal pages and set EXPO_PUBLIC_TERMS_URL and EXPO_PUBLIC_PRIVACY_URL in your environment.',
    );
    return;
  }
  const ok = await Linking.canOpenURL(u);
  if (!ok) {
    Alert.alert(label, 'Cannot open this link.');
    return;
  }
  await Linking.openURL(u);
}

export async function openTermsOfService(): Promise<void> {
  await openLegalUrl(env.EXPO_PUBLIC_TERMS_URL, 'Terms of service');
}

export async function openPrivacyPolicy(): Promise<void> {
  await openLegalUrl(env.EXPO_PUBLIC_PRIVACY_URL, 'Privacy policy');
}
