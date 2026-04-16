import * as WebBrowser from 'expo-web-browser';
import { FunctionsHttpError } from '@supabase/functions-js';
import { Platform } from 'react-native';

import { getStripeConnectDeviceCountry } from '@/lib/stripeConnectCountryHint';
import { buildStripeConnectRedirectUrls } from '@/lib/stripeConnectUrls';
import { getValidAccessToken, invokeEdgeFunction, invokeEdgeFunctionWithToken } from '@/lib/supabaseEdgeInvoke';

export type StripeConnectStatus = {
  ok?: boolean;
  connected: boolean;
  account_id: string | null;
  payouts_enabled: boolean;
  charges_enabled?: boolean;
  details_submitted?: boolean;
  requirements_currently_due?: string[];
  dashboard_url?: string | null;
};

async function parseFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const j = (await error.context.json()) as { error?: string };
      if (j?.error) return j.error;
    } catch {
      /* ignore */
    }
  }
  return error instanceof Error ? error.message : 'Request failed';
}

/** Opens Stripe Connect Express onboarding in the browser. */
export async function openStripeConnectOnboarding(): Promise<void> {
  const { refreshUrl, returnUrl } = buildStripeConnectRedirectUrls();
  const deviceCountry = getStripeConnectDeviceCountry();

  const { data, error } = await invokeEdgeFunction('createStripeConnectLink', {
    body: {
      refreshUrl,
      returnUrl,
      ...(deviceCountry ? { deviceCountry } : {}),
    },
  });

  if (error) {
    throw new Error(await parseFunctionError(error));
  }

  const payload = data as { ok?: boolean; url?: string; error?: string };
  if (payload?.error) throw new Error(payload.error);
  const url = payload?.url;
  if (!url) throw new Error('No onboarding URL returned');

  // Must match Stripe `return_url` so the in-app browser can dismiss when onboarding finishes.
  if (Platform.OS === 'web') {
    await WebBrowser.openBrowserAsync(url);
    return;
  }

  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    // User closed the sheet — status refresh happens when they return to the screen.
  }
}

/** Loads Connect account flags from Edge (payouts enabled, Stripe Express dashboard link). */
export async function fetchStripeConnectStatus(): Promise<StripeConnectStatus | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const { data, error } = await invokeEdgeFunctionWithToken('getStripeConnectAccount', accessToken, {
    body: {},
  });

  if (error) {
    console.warn('[fetchStripeConnectStatus]', await parseFunctionError(error));
    return null;
  }

  return data as StripeConnectStatus;
}
