import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { FunctionsHttpError } from '@supabase/functions-js';

import { getSupabase } from '@/supabase/client';

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
  const supabase = getSupabase();

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    throw new Error('Sign in to purchase.');
  }

  await supabase.auth.refreshSession();

  const base = Linking.createURL('profile/add-funds');
  const successUrl = `${base}${base.includes('?') ? '&' : '?'}status=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}${base.includes('?') ? '&' : '?'}status=cancel`;

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

  const { data, error } = await supabase.functions.invoke('createWalletCheckoutSession', {
    body,
  });

  if (error) {
    throw new Error(await parseFunctionError(error));
  }

  const payload = data as { ok?: boolean; url?: string; error?: string };
  if (payload?.error) throw new Error(payload.error);
  const url = payload?.url;
  if (!url) throw new Error('No checkout URL returned');

  const result = await WebBrowser.openAuthSessionAsync(url, base);

  if (result.type === 'success' && result.url) {
    if (result.url.includes('status=cancel')) return false;
    if (result.url.includes('status=success')) return true;
  }
  return false;
}
