/**
 * Returns Stripe Connect account status for the signed-in user (payouts enabled, requirements).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST' && req.method !== 'GET') return errorResponse('Method not allowed', 405);

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

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
    const acct = await stripe.accounts.retrieve(accountId);

    let dashboardUrl: string | null = null;
    try {
      const login = await stripe.accounts.createLoginLink(accountId);
      dashboardUrl = login.url;
    } catch {
      /* Express account may not have dashboard yet */
    }

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
