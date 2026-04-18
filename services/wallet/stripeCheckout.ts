import * as WebBrowser from 'expo-web-browser';
import { FunctionsHttpError } from '@supabase/functions-js';
import { Platform } from 'react-native';

import { walletCheckoutStripeReturnUrls } from '@/lib/walletCheckoutReturnUrls';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';

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

/**
 * Opens Stripe Checkout in the browser. Returns whether the user completed payment (success redirect).
 * Balance updates only after the Stripe webhook runs — caller should invalidate profile on success.
 */
export async function openStripeCheckoutSession(opts: WalletOpts | CreditsOpts): Promise<boolean> {
  const { successUrl, cancelUrl, authSessionRedirect } = walletCheckoutStripeReturnUrls();

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

  const { data, error } = await invokeEdgeFunction('createWalletCheckoutSession', {
    body,
  });

  if (error) {
    if (error instanceof Error && error.message === 'Sign in to continue.') {
      throw new Error('Sign in to purchase.');
    }
    throw new Error(await parseFunctionError(error));
  }

  const payload = data as { ok?: boolean; url?: string; error?: string };
  if (payload?.error) throw new Error(payload.error);
  const url = payload?.url;
  if (!url) throw new Error('No checkout URL returned');

  /**
   * Mobile Safari and many mobile browsers block or break `openAuthSessionAsync` (popup / async gesture).
   * Same-tab navigation always works; completion is handled when the user returns to `successUrl` (see add-funds).
   */
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.location.assign(url);
    return false;
  }

  const result = await WebBrowser.openAuthSessionAsync(url, authSessionRedirect);

  if (result.type === 'success' && result.url) {
    if (result.url.includes('status=cancel')) return false;
    if (result.url.includes('status=success')) return true;
  }
  return false;
}
