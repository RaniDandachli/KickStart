/**
 * Stripe webhooks: Checkout (hosted) + Payment Sheet (PaymentIntent).
 * Events: checkout.session.completed, payment_intent.succeeded
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

const PACK_PRICES: Record<number, number> = {
  500: 499,
  1200: 999,
  3000: 1999,
  8000: 4999,
};

/** Must match createWalletPaymentIntent / createWalletCheckoutSession wallet fee. */
function walletExpectedChargeCents(walletCents: number): number {
  return walletCents + Math.round(walletCents * 0.029) + 30;
}

/** Returns null if valid, else a skip reason string. */
function validatePurchaseMetadata(
  meta: Stripe.Metadata,
  amountTotalCents: number,
): string | null {
  const userId = meta.user_id;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    console.error('[stripeWebhook] missing or invalid user_id in metadata', meta);
    return 'bad_metadata';
  }

  const walletCents = Math.max(0, Math.floor(Number.parseInt(meta.wallet_cents ?? '0', 10) || 0));
  const prizeCredits = Math.max(0, Math.floor(Number.parseInt(meta.prize_credits ?? '0', 10) || 0));

  if (meta.kind === 'credits') {
    if (prizeCredits <= 0) return 'no_credits';
    if (walletCents !== 0) return 'invalid_wallet_with_credits';
    const expectedCents = PACK_PRICES[prizeCredits];
    if (expectedCents === undefined || expectedCents !== amountTotalCents) {
      console.error('[stripeWebhook] credit pack price mismatch', { prizeCredits, amountTotalCents, expectedCents });
      return 'pack_price_mismatch';
    }
  } else if (meta.kind === 'wallet') {
    if (walletCents <= 0 || prizeCredits !== 0) return 'invalid_wallet_metadata';
    const expectedCharge = walletExpectedChargeCents(walletCents);
    if (expectedCharge !== amountTotalCents) {
      console.error('[stripeWebhook] wallet charge mismatch', { walletCents, expectedCharge, amountTotalCents });
      return 'amount_mismatch';
    }
  } else {
    return 'unknown_kind';
  }
  return null;
}

function amountsFromMeta(meta: Stripe.Metadata) {
  return {
    userId: meta.user_id as string,
    walletCents: Math.max(0, Math.floor(Number.parseInt(meta.wallet_cents ?? '0', 10) || 0)),
    prizeCredits: Math.max(0, Math.floor(Number.parseInt(meta.prize_credits ?? '0', 10) || 0)),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    if (!stripeSecret || !webhookSecret) return errorResponse('Webhook not configured', 503);

    const signature = req.headers.get('stripe-signature');
    if (!signature) return errorResponse('Missing stripe-signature', 400);

    const rawBody = await req.text();

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (e) {
      console.error('[stripeWebhook] signature verify failed', e);
      return errorResponse('Invalid signature', 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'payment') {
        return json({ received: true, skipped: 'not_payment_mode' });
      }
      if (session.payment_status !== 'paid') {
        return json({ received: true, skipped: 'not_paid' });
      }

      const meta = session.metadata ?? {};
      const amountTotal = session.amount_total ?? 0;
      const skip = validatePurchaseMetadata(meta, amountTotal);
      if (skip) return json({ received: true, skipped: skip });

      const { userId, walletCents, prizeCredits } = amountsFromMeta(meta);
      const desc =
        meta.kind === 'credits'
          ? `Arcade credits (${prizeCredits}) — Stripe`
          : `Wallet top-up — Stripe`;

      const { data: rpcData, error: rpcErr } = await admin.rpc('fulfill_stripe_checkout_session', {
        p_user_id: userId,
        p_checkout_session_id: session.id,
        p_wallet_cents_add: walletCents,
        p_prize_credits_add: prizeCredits,
        p_description: desc,
        p_stripe_event_id: event.id,
      });

      if (rpcErr) {
        console.error('[stripeWebhook] rpc error', rpcErr);
        return errorResponse(rpcErr.message, 500);
      }

      const result = rpcData as { ok?: boolean; duplicate?: boolean };
      return json({ received: true, fulfilled: result?.ok === true, duplicate: result?.duplicate === true });
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const meta = pi.metadata ?? {};
      const amountCents = pi.amount_received ?? pi.amount ?? 0;
      const skip = validatePurchaseMetadata(meta, amountCents);
      if (skip) return json({ received: true, skipped: skip });

      const { userId, walletCents, prizeCredits } = amountsFromMeta(meta);
      const desc =
        meta.kind === 'credits'
          ? `Arcade credits (${prizeCredits}) — Stripe`
          : `Wallet top-up — Stripe`;

      const { data: rpcData, error: rpcErr } = await admin.rpc('fulfill_stripe_payment_intent', {
        p_user_id: userId,
        p_payment_intent_id: pi.id,
        p_wallet_cents_add: walletCents,
        p_prize_credits_add: prizeCredits,
        p_description: desc,
        p_stripe_event_id: event.id,
      });

      if (rpcErr) {
        console.error('[stripeWebhook] payment_intent rpc error', rpcErr);
        return errorResponse(rpcErr.message, 500);
      }

      const result = rpcData as { ok?: boolean; duplicate?: boolean };
      return json({ received: true, fulfilled: result?.ok === true, duplicate: result?.duplicate === true });
    }

    return json({ received: true });
  } catch (e) {
    console.error('[stripeWebhook]', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
