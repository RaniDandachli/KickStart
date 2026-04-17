import * as WebBrowser from 'expo-web-browser';
import { FunctionsHttpError } from '@supabase/functions-js';
import { Platform } from 'react-native';

import { buildWhopPayoutRedirectUrls } from '@/lib/whopConnectUrls';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';

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

/** Opens Whop hosted payouts portal (KYC + bank) in the in-app browser. */
export async function openWhopPayoutPortal(): Promise<void> {
  const { refreshUrl, returnUrl } = buildWhopPayoutRedirectUrls();

  const { data, error } = await invokeEdgeFunction('createWhopPayoutPortalLink', {
    body: { refreshUrl, returnUrl },
  });

  if (error) {
    throw new Error(await parseFunctionError(error));
  }

  const payload = data as { ok?: boolean; url?: string; error?: string };
  if (payload?.error) throw new Error(payload.error);
  const url = payload?.url;
  if (!url) throw new Error('No payout portal URL returned');

  if (Platform.OS === 'web') {
    await WebBrowser.openBrowserAsync(url);
    return;
  }

  await WebBrowser.openAuthSessionAsync(url, returnUrl);
}
