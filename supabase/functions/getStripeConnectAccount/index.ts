/**
 * Returns Stripe Connect account status for the signed-in user (payouts enabled, requirements).
 *
 * Uses Stripe HTTP API via fetch (not stripe-node) so Deno Edge avoids Node polyfill microtask errors
 * on isolate shutdown: `Deno.core.runMicrotasks() is not supported in this environment`.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';
import { stripeCreateExpressLoginLink, stripeRetrieveAccount } from '../_shared/stripeRest.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST' && req.method !== 'GET') return errorResponse('Method not allowed', 405);

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
      if (userErr) console.warn('[getStripeConnectAccount] getUser', userErr.message);
      return errorResponse('Unauthorized', 401);
    }

    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('stripe_connect_account_id')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profile) return errorResponse('Profile not found', 404);

    const accountId = profile.stripe_connect_account_id as string | null;
    if (!accountId) {
      return json({
        ok: true,
        connected: false,
        account_id: null,
        payouts_enabled: false,
        details_submitted: false,
      });
    }

    const acct = await stripeRetrieveAccount(stripeSecret, accountId);

    const dashboardUrl = await stripeCreateExpressLoginLink(stripeSecret, accountId);

    return json({
      ok: true,
      connected: true,
      account_id: accountId,
      payouts_enabled: acct.payouts_enabled === true,
      charges_enabled: acct.charges_enabled === true,
      details_submitted: acct.details_submitted === true,
      requirements_currently_due: acct.requirements?.currently_due ?? [],
      dashboard_url: dashboardUrl,
    });
  } catch (e) {
    console.error('[getStripeConnectAccount]', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
