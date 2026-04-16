/**
 * Stripe Connect Express — bank payouts for players.
 * Prefills business category + profile info from RunitArcade so Stripe asks for less on the hosted page.
 *
 * Uses Stripe HTTP API via fetch (not stripe-node) to avoid Deno Edge microtask / runMicrotasks errors.
 *
 * Deploy: `npx supabase functions deploy createStripeConnectLink` (secret `STRIPE_SECRET_KEY` on the project).
 * Ops checklist: `supabase/README.md` → “Stripe Connect (bank onboarding + payouts)”.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';
import {
  stripeAccountLinksCreate,
  stripeAccountsCreate,
  stripeAccountsUpdate,
} from '../_shared/stripeRest.ts';

const Body = z.object({
  refreshUrl: z.string().min(8),
  returnUrl: z.string().min(8),
  /** ISO 3166-1 alpha-2 from app (expo-localization region); used when profile has no shipping country */
  deviceCountry: z
    .string()
    .length(2)
    .regex(/^[a-zA-Z]{2}$/)
    .optional()
    .transform((s) => s.toUpperCase()),
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

/**
 * US Express accounts: Stripe requires `card_payments` when requesting `transfers`
 * (see invalid_request_error on requested_capabilities).
 */
function capabilitiesForCountry(country: string): Record<string, { requested: boolean }> {
  if (country === 'US') {
    return {
      card_payments: { requested: true },
      transfers: { requested: true },
    };
  }
  return { transfers: { requested: true } };
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
}): Record<string, unknown> {
  const { first, last } = splitName(params.displayName, params.username);
  const ship = params.shipping;
  const country = countryToStripeCode(ship?.country, params.defaultCountry);

  const individual: Record<string, unknown> = {
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
    capabilities: capabilitiesForCountry(country),
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
  secret: string,
  accountId: string,
  prefill: Record<string, unknown>,
): Promise<void> {
  try {
    const ind = prefill.individual as Record<string, unknown> | undefined;
    await stripeAccountsUpdate(secret, accountId, {
      business_profile: prefill.business_profile,
      email: prefill.email,
      individual: {
        email: ind?.email,
        first_name: ind?.first_name,
        last_name: ind?.last_name,
        address: ind?.address,
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
    const authHeader =
      req.headers.get('Authorization')?.trim() ||
      req.headers.get('authorization')?.trim() ||
      '';
    if (!authHeader || !/^Bearer\s+\S+/.test(authHeader)) {
      return errorResponse('Unauthorized: missing Authorization bearer token', 401);
    }
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      if (userErr) console.warn('[createStripeConnectLink] getUser', userErr.message);
      return errorResponse('Unauthorized', 401);
    }

    const userId = userData.user.id;
    const email = userData.user.email ?? undefined;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const { refreshUrl, returnUrl, deviceCountry: deviceCountryRaw } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('stripe_connect_account_id, display_name, username, shipping_address, country_code')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profile) return errorResponse('Profile not found', 404);

    const shipping = profile.shipping_address as Ship | null;

    const metaRaw = (userData.user.user_metadata as { country_code?: unknown } | null)?.country_code;
    const fromMeta =
      typeof metaRaw === 'string' && metaRaw.trim().length > 0
        ? countryToStripeCode(metaRaw, '')
        : '';
    const fromProfile =
      typeof profile.country_code === 'string' && profile.country_code.trim().length > 0
        ? countryToStripeCode(profile.country_code, '')
        : '';
    const fromShipping = shipping?.country ? countryToStripeCode(shipping.country, '') : '';
    const fromDevice = deviceCountryRaw ? countryToStripeCode(deviceCountryRaw, '') : '';
    const fromEnv = (Deno.env.get('STRIPE_CONNECT_DEFAULT_COUNTRY') ?? '').trim().toUpperCase();

    /** Signup/profile country, then metadata (email-verify flow), then shipping, device, env, US. */
    const defaultCountry =
      (fromProfile.length === 2 ? fromProfile : null) ??
      (fromMeta.length === 2 ? fromMeta : null) ??
      (fromShipping.length === 2 ? fromShipping : null) ??
      (fromDevice.length === 2 ? fromDevice : null) ??
      (fromEnv.length === 2 ? fromEnv : null) ??
      'US';

    const businessUrl = Deno.env.get('STRIPE_CONNECT_BUSINESS_URL') ?? 'https://runitarcade.app';
    const businessName = Deno.env.get('STRIPE_CONNECT_BUSINESS_NAME') ?? 'RunitArcade';
    const mcc = Deno.env.get('STRIPE_CONNECT_MCC') ?? '7994';
    const productDescription =
      Deno.env.get('STRIPE_CONNECT_PRODUCT_DESCRIPTION') ??
      'Mobile skill contests and tournament prizes — player payouts';

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

    let accountId = profile.stripe_connect_account_id as string | null;
    if (!accountId) {
      const account = await stripeAccountsCreate(stripeSecret, prefill);
      accountId = account.id;
      const { error: upErr } = await admin
        .from('profiles')
        .update({ stripe_connect_account_id: accountId, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (upErr) console.error('[createStripeConnectLink] failed to save connect account id', upErr);
    } else {
      await applyPrefillToExistingAccount(stripeSecret, accountId, prefill);
      const country = countryToStripeCode(shipping?.country, defaultCountry);
      if (country === 'US') {
        try {
          await stripeAccountsUpdate(stripeSecret, accountId, {
            capabilities: capabilitiesForCountry('US'),
          });
        } catch (e) {
          console.warn('[createStripeConnectLink] US capabilities repair skipped:', e);
        }
      }
    }

    const link = await stripeAccountLinksCreate(stripeSecret, {
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
    const msg = e instanceof Error ? e.message : 'error';
    /** Stripe returns this until the platform completes Connect onboarding in the Dashboard. */
    const connectNotActivated = /signed up for Connect/i.test(msg);
    const friendly = connectNotActivated
      ? 'Stripe Connect is not activated for this Stripe account. In the Stripe Dashboard open Connect and finish platform setup (agreements / profile), then try again. Use Test mode with sk_test_ until you are ready for live.'
      : msg;
    return errorResponse(friendly, connectNotActivated ? 503 : 500);
  }
});
