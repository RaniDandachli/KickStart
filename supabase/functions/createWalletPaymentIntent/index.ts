/**
 * Creates a Stripe PaymentIntent for in-app Payment Sheet (wallet top-up or credit packs).
 * Metadata is verified in stripeWebhook on payment_intent.succeeded.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const MIN_WALLET_CENTS = 100;
const MAX_WALLET_CENTS = 50_000;

/** Pass-through for card processing; user-chosen amount is credited in full (see stripeWebhook wallet validation). */
function walletProcessingFeeCents(walletCents: number): number {
  return Math.round(walletCents * 0.029) + 30;
}

const CREDIT_PACKAGES: Record<string, { priceCents: number; prizeCredits: number; name: string }> = {
  credits_500: { priceCents: 499, prizeCredits: 500, name: '500 Arcade Credits' },
  credits_1200: { priceCents: 999, prizeCredits: 1200, name: '1,200 Arcade Credits' },
  credits_3000: { priceCents: 1999, prizeCredits: 3000, name: '3,000 Arcade Credits' },
  credits_8000: { priceCents: 4999, prizeCredits: 8000, name: '8,000 Arcade Credits' },
};

const Body = z.object({
  kind: z.enum(['wallet', 'credits']),
  amountCents: z.number().int().optional(),
  packageId: z.string().optional(),
});

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

    const { kind } = parsed.data;
    let lineAmountCents: number;
    let walletCents = 0;
    let prizeCredits = 0;

    if (kind === 'wallet') {
      const ac = parsed.data.amountCents;
      if (ac === undefined) return errorResponse('amountCents required for wallet top-up', 422);
      if (ac < MIN_WALLET_CENTS || ac > MAX_WALLET_CENTS) {
        return errorResponse(`Amount must be between $${(MIN_WALLET_CENTS / 100).toFixed(2)} and $${(MAX_WALLET_CENTS / 100).toFixed(2)}`, 422);
      }
      walletCents = ac;
      const feeCents = walletProcessingFeeCents(ac);
      lineAmountCents = ac + feeCents;
    } else {
      const pid = parsed.data.packageId;
      if (!pid) return errorResponse('packageId required for credit packs', 422);
      const pack = CREDIT_PACKAGES[pid];
      if (!pack) return errorResponse('Unknown credit package', 422);
      lineAmountCents = pack.priceCents;
      prizeCredits = pack.prizeCredits;
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profile) return errorResponse('Profile not found', 404);

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });

    let customerId = profile.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: lineAmountCents,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: userId,
        kind,
        wallet_cents: String(walletCents),
        processing_fee_cents: kind === 'wallet' ? String(walletProcessingFeeCents(walletCents)) : '0',
        prize_credits: String(prizeCredits),
        package_id: parsed.data.packageId ?? '',
      },
    });

    const clientSecret = paymentIntent.client_secret;
    if (!clientSecret) return errorResponse('Stripe did not return a client secret', 502);

    return json({
      ok: true,
      paymentIntentClientSecret: clientSecret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (e) {
    console.error('[createWalletPaymentIntent]', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
