/**
 * Stripe Connect Express — bank payouts for players.
 * Prefills business category + profile info from RunitArcade so Stripe asks for less on the hosted page.
 * (Stripe may still require ID/bank steps for compliance — we don’t add extra verification in our app.)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  refreshUrl: z.string().min(8),
  returnUrl: z.string().min(8),
});

type Ship = {
  fullName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

function splitName(display: string | null | undefined, fallback: string): { first: string; last: string } {
  const s = (display ?? fallback).trim();
  if (!s) return { first: 'Player', last: 'RunitArcade' };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first: parts[0]!, last: parts[0]! };
  return { first: parts[0]!, last: parts.slice(1).join(' ') };
}

function countryToStripeCode(raw: string | undefined, fallback: string): string {
  if (!raw?.trim()) return fallback;
  const u = raw.trim().toUpperCase();
  if (u.length === 2) return u;
  const map: Record<string, string> = {
    'UNITED STATES': 'US',
    USA: 'US',
    'UNITED KINGDOM': 'GB',
    UK: 'GB',
    CANADA: 'CA',
    AUSTRALIA: 'AU',
  };
  return map[u] ?? fallback;
}

function buildConnectPrefill(params: {
  email: string | undefined;
  displayName: string | null;
  username: string;
  shipping: Ship | null;
  defaultCountry: string;
  businessUrl: string;
  businessName: string;
  mcc: string;
  productDescription: string;
}): Parameters<Stripe['accounts']['create']>[0] {
  const { first, last } = splitName(params.displayName, params.username);
  const ship = params.shipping;
  const country = countryToStripeCode(ship?.country, params.defaultCountry);

  const individual: NonNullable<Parameters<Stripe['accounts']['create']>[0]['individual']> = {
    email: params.email,
    first_name: first.slice(0, 100),
    last_name: last.slice(0, 100),
  };

  if (ship?.line1?.trim() && ship.city?.trim() && ship.postalCode?.trim()) {
    const state = (ship.region ?? '').trim().slice(0, 50);
    const needsState = country === 'US' || country === 'CA' || country === 'AU';
    if (!needsState || state.length > 0) {
      individual.address = {
        line1: ship.line1.trim().slice(0, 200),
        ...(ship.line2?.trim() ? { line2: ship.line2.trim().slice(0, 200) } : {}),
        city: ship.city.trim(),
        ...(state ? { state } : {}),
        postal_code: ship.postalCode.trim(),
        country,
      };
    }
  }

  return {
    type: 'express',
    country,
    email: params.email,
    business_type: 'individual',
    capabilities: {
      transfers: { requested: true },
    },
    business_profile: {
      name: params.businessName,
      url: params.businessUrl,
      mcc: params.mcc,
      product_description: params.productDescription,
    },
    individual,
    metadata: { platform: 'runitarcade', flow: 'player_payouts' },
  };
}

async function applyPrefillToExistingAccount(
  stripe: Stripe,
  accountId: string,
  prefill: Parameters<Stripe['accounts']['create']>[0],
): Promise<void> {
  try {
    await stripe.accounts.update(accountId, {
      business_profile: prefill.business_profile,
      email: prefill.email,
      individual: {
        email: prefill.individual?.email,
        first_name: prefill.individual?.first_name,
        last_name: prefill.individual?.last_name,
        address: prefill.individual?.address,
      },
    });
  } catch (e) {
    console.warn('[createStripeConnectLink] accounts.update prefill skipped:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) return errorResponse('Stripe is not configured (STRIPE_SECRET_KEY)', 503);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return errorResponse('Unauthorized', 401);

    const userId = userData.user.id;
    const email = userData.user.email ?? undefined;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const { refreshUrl, returnUrl } = parsed.data;

    const defaultCountry = (Deno.env.get('STRIPE_CONNECT_DEFAULT_COUNTRY') ?? 'US').toUpperCase();
    const businessUrl = Deno.env.get('STRIPE_CONNECT_BUSINESS_URL') ?? 'https://runitarcade.app';
    const businessName = Deno.env.get('STRIPE_CONNECT_BUSINESS_NAME') ?? 'RunitArcade';
    const mcc = Deno.env.get('STRIPE_CONNECT_MCC') ?? '7994';
    const productDescription =
      Deno.env.get('STRIPE_CONNECT_PRODUCT_DESCRIPTION') ??
      'Mobile skill contests and tournament prizes — player payouts';

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('stripe_connect_account_id, display_name, username, shipping_address')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profile) return errorResponse('Profile not found', 404);

    const shipping = profile.shipping_address as Ship | null;

    const prefill = buildConnectPrefill({
      email,
      displayName: profile.display_name as string | null,
      username: (profile.username as string) ?? 'player',
      shipping,
      defaultCountry,
      businessUrl,
      businessName,
      mcc,
      productDescription,
    });

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });

    let accountId = profile.stripe_connect_account_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create(prefill);
      accountId = account.id;
      const { error: upErr } = await admin
        .from('profiles')
        .update({ stripe_connect_account_id: accountId, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (upErr) console.error('[createStripeConnectLink] failed to save connect account id', upErr);
    } else {
      await applyPrefillToExistingAccount(stripe, accountId, prefill);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
      collection_options: {
        fields: 'currently_due',
      },
    });

    return json({ ok: true, url: link.url });
  } catch (e) {
    console.error('[createStripeConnectLink]', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
