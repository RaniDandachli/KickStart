import * as WebBrowser from 'expo-web-browser';
import { FunctionsHttpError } from '@supabase/functions-js';
import { Platform } from 'react-native';

import { runWhopCheckoutUI } from '@/lib/whopCheckoutBridge';
import type { WhopCheckoutPayload } from '@/lib/whopCheckoutTypes';
import { walletCheckoutWhopReturnUrls } from '@/lib/walletCheckoutReturnUrls';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';

export type { WhopCheckoutPayload } from '@/lib/whopCheckoutTypes';

type WalletOpts = { kind: 'wallet'; amountCents: number };
type CreditsOpts = { kind: 'credits'; packageId: string };

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

async function buildWhopCheckoutPayload(opts: WalletOpts | CreditsOpts): Promise<WhopCheckoutPayload> {
  const { successUrl, cancelUrl, authSessionRedirect } = walletCheckoutWhopReturnUrls();

  const body =
    opts.kind === 'wallet'
      ? {
          kind: 'wallet' as const,
          amountCents: opts.amountCents,
          successUrl,
          cancelUrl,
        }
      : {
          kind: 'credits' as const,
          packageId: opts.packageId,
          successUrl,
          cancelUrl,
        };

  const { data, error } = await invokeEdgeFunction('createWhopCheckoutSession', {
    body,
  });

  if (error) {
    if (error instanceof Error && error.message === 'Sign in to continue.') {
      throw new Error('Sign in to purchase.');
    }
    throw new Error(await parseFunctionError(error));
  }

  const payload = data as { ok?: boolean; url?: string; sessionId?: string | null; error?: string };
  if (payload?.error) throw new Error(payload.error);
  const url = payload?.url;
  if (!url) throw new Error('No checkout URL returned');

  return {
    url,
    sessionId: payload.sessionId ?? null,
    returnUrl: successUrl,
    authSessionRedirect,
  };
}

/**
 * Opens Whop checkout in-app when Shop is mounted (`WhopCheckoutHost`); otherwise falls back to the system browser.
 * Balances update after `whopWebhook` — caller should invalidate profile on success.
 */
export async function openWhopCheckoutSession(opts: WalletOpts | CreditsOpts): Promise<boolean> {
  const p = await buildWhopCheckoutPayload(opts);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.location.assign(p.url);
    return false;
  }

  return runWhopCheckoutUI(p, async () => {
    const result = await WebBrowser.openAuthSessionAsync(p.url, p.authSessionRedirect);

    if (result.type === 'success' && result.url) {
      if (result.url.includes('status=cancel')) return false;
      if (result.url.includes('status=success')) return true;
    }
    return false;
  });
}
