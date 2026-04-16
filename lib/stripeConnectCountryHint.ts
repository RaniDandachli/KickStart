import * as Localization from 'expo-localization';

/**
 * ISO 3166-1 alpha-2 country code from the **device region** (Settings → General → Language & Region),
 * not GPS. A Canadian in the US with a US region phone will get US — users should set shipping on profile for accuracy.
 */
export function getStripeConnectDeviceCountry(): string | undefined {
  try {
    const locales = Localization.getLocales?.();
    const region = locales?.[0]?.regionCode;
    if (typeof region === 'string' && /^[A-Za-z]{2}$/.test(region)) {
      return region.toUpperCase();
    }
  } catch {
    /* expo-localization unavailable in some environments */
  }
  return undefined;
}
