/**
 * Creates a Stripe Checkout Session for wallet top-up or arcade credit packs.
 * Metadata is verified again in stripeWebhook before crediting balances.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const MIN_WALLET_CENTS = 100;
const MAX_WALLET_CENTS = 50_000; // $500.00 — keep aligned with `completeTopUp` client limits

/** Must match `lib/creditPackages.ts` ids and amounts. */
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
  successUrl: z.string().min(8),
  cancelUrl: z.string().min(8),
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

    const { kind, successUrl, cancelUrl } = parsed.data;
    let lineAmountCents: number;
    let productName: string;
    let walletCents = 0;
    let prizeCredits = 0;

    if (kind === 'wallet') {
      const ac = parsed.data.amountCents;
      if (ac === undefined) return errorResponse('amountCents required for wallet top-up', 422);
      if (ac < MIN_WALLET_CENTS || ac > MAX_WALLET_CENTS) {
        return errorResponse(`Amount must be between $${(MIN_WALLET_CENTS / 100).toFixed(2)} and $${(MAX_WALLET_CENTS / 100).toFixed(2)}`, 422);
      }
      lineAmountCents = ac;
      walletCents = ac;
      productName = `Wallet top-up ($${(ac / 100).toFixed(2)})`;
    } else {
      const pid = parsed.data.packageId;
      if (!pid) return errorResponse('packageId required for credit packs', 422);
      const pack = CREDIT_PACKAGES[pid];
      if (!pack) return errorResponse('Unknown credit package', 422);
      lineAmountCents = pack.priceCents;
      prizeCredits = pack.prizeCredits;
      productName = pack.name;
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
      const { error: upErr } = await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (upErr) console.error('[createWalletCheckoutSession] failed to save customer id', upErr);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      client_reference_id: userId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: lineAmountCents,
            product_data: {
              name: productName,
              metadata: { app: 'kickclash' },
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
        kind,
        wallet_cents: String(walletCents),
        prize_credits: String(prizeCredits),
        package_id: parsed.data.packageId ?? '',
      },
    });

    if (!session.url) return errorResponse('Stripe did not return a checkout URL', 502);

    return json({ ok: true, url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('[createWalletCheckoutSession]', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
