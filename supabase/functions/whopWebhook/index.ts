/**
 * Whop Standard Webhooks — payment.succeeded → fulfill_whop_payment (idempotent).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
/** Package name is `standardwebhooks` (no hyphen). `npm:` spec fails on Supabase bundle — use esm.sh. */
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0?target=deno';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const PACK_PRICES: Record<number, number> = {
  500: 499,
  1200: 999,
  3000: 1999,
  8000: 4999,
};

function walletExpectedChargeCents(walletCents: number): number {
  return walletCents + Math.round(walletCents * 0.029) + 30;
}

type StringMap = Record<string, string>;

/** Returns null if valid, else a skip reason string. */
function validatePurchaseMetadata(meta: StringMap, paidCents: number, expectedCents: number): string | null {
  const userId = meta.user_id;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    console.error('[whopWebhook] missing or invalid user_id in metadata', meta);
    return 'bad_metadata';
  }

  if (paidCents !== expectedCents && Math.abs(paidCents - expectedCents) > 1) {
    console.error('[whopWebhook] paid amount mismatch', { paidCents, expectedCents, meta });
    return 'amount_mismatch';
  }

  const walletCents = Math.max(0, Math.floor(Number.parseInt(meta.wallet_cents ?? '0', 10) || 0));
  const prizeCredits = Math.max(0, Math.floor(Number.parseInt(meta.prize_credits ?? '0', 10) || 0));

  if (meta.kind === 'credits') {
    if (prizeCredits <= 0) return 'no_credits';
    if (walletCents !== 0) return 'invalid_wallet_with_credits';
    const packCents = PACK_PRICES[prizeCredits];
    if (packCents === undefined || packCents !== expectedCents) return 'pack_price_mismatch';
  } else if (meta.kind === 'wallet') {
    if (walletCents <= 0 || prizeCredits !== 0) return 'invalid_wallet_metadata';
    if (walletExpectedChargeCents(walletCents) !== expectedCents) return 'wallet_math_mismatch';
  } else {
    return 'unknown_kind';
  }
  return null;
}

function amountsFromMeta(meta: StringMap) {
  return {
    userId: meta.user_id as string,
    walletCents: Math.max(0, Math.floor(Number.parseInt(meta.wallet_cents ?? '0', 10) || 0)),
    prizeCredits: Math.max(0, Math.floor(Number.parseInt(meta.prize_credits ?? '0', 10) || 0)),
  };
}

/** Map Whop dollar fields to cents and pick the one that matches our configured line price (within 1¢). */
function resolvePaidCents(payment: Record<string, unknown>, expectedCents: number): number {
  const candidates: number[] = [];
  for (const key of ['subtotal', 'total', 'usd_total'] as const) {
    const v = payment[key];
    if (typeof v === 'number' && Number.isFinite(v)) candidates.push(Math.round(v * 100));
  }
  if (candidates.length === 0) return -1;
  const exact = candidates.find((c) => c === expectedCents);
  if (exact !== undefined) return exact;
  const near = candidates.find((c) => Math.abs(c - expectedCents) <= 1);
  if (near !== undefined) return near;
  return -1;
}

function normalizeMetadata(raw: unknown): StringMap {
  if (!raw || typeof raw !== 'object') return {};
  const out: StringMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const secret = Deno.env.get('WHOP_WEBHOOK_SECRET')?.trim();
    if (!secret) return errorResponse('Webhook not configured (WHOP_WEBHOOK_SECRET)', 503);

    const rawBody = await req.text();

    const passHeaders: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      passHeaders[k] = v;
    });

    let envelope: { type?: string; data?: unknown };
    try {
      const wh = new Webhook(secret);
      const verified = wh.verify(rawBody, passHeaders);
      envelope =
        typeof verified === 'string'
          ? (JSON.parse(verified) as { type?: string; data?: unknown })
          : (verified as { type?: string; data?: unknown });
    } catch (e) {
      console.error('[whopWebhook] signature verify failed', e);
      return errorResponse('Invalid signature', 400);
    }

    if (envelope.type !== 'payment.succeeded') {
      return json({ received: true, skipped: 'event_type' });
    }

    const payment = envelope.data as Record<string, unknown> | undefined;
    if (!payment || typeof payment !== 'object') {
      return json({ received: true, skipped: 'no_data' });
    }

    const paymentId = typeof payment.id === 'string' ? payment.id : '';
    if (!paymentId) {
      console.error('[whopWebhook] missing payment id');
      return json({ received: true, skipped: 'no_payment_id' });
    }

    const meta = normalizeMetadata(payment.metadata);

    const walletCentsMeta = Math.max(0, Math.floor(Number.parseInt(meta.wallet_cents ?? '0', 10) || 0));
    const prizeCreditsMeta = Math.max(0, Math.floor(Number.parseInt(meta.prize_credits ?? '0', 10) || 0));
    let expectedCents = 0;
    if (meta.kind === 'credits') {
      expectedCents = PACK_PRICES[prizeCreditsMeta] ?? -1;
    } else if (meta.kind === 'wallet') {
      expectedCents = walletCentsMeta > 0 ? walletExpectedChargeCents(walletCentsMeta) : -1;
    } else {
      expectedCents = -1;
    }
    if (expectedCents < 0) {
      return json({ received: true, skipped: 'bad_expected_from_meta' });
    }

    const paidCents = resolvePaidCents(payment, expectedCents);
    if (paidCents < 0) {
      console.error('[whopWebhook] could not match payment amount to expected', { expectedCents, payment });
      return json({ received: true, skipped: 'no_amount' });
    }

    const skip = validatePurchaseMetadata(meta, paidCents, expectedCents);
    if (skip) return json({ received: true, skipped: skip });

    const { userId, walletCents, prizeCredits } = amountsFromMeta(meta);
    const desc =
      meta.kind === 'credits'
        ? `Arcade credits (${prizeCredits}) — Whop`
        : `Wallet top-up — Whop`;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const whopEventId = req.headers.get('webhook-id')?.trim() ?? '';

    const { data: rpcData, error: rpcErr } = await admin.rpc('fulfill_whop_payment', {
      p_user_id: userId,
      p_payment_id: paymentId,
      p_wallet_cents_add: walletCents,
      p_prize_credits_add: prizeCredits,
      p_description: desc,
      p_whop_event_id: whopEventId || null,
    });

    if (rpcErr) {
      console.error('[whopWebhook] rpc error', rpcErr);
      return errorResponse(rpcErr.message, 500);
    }

    const result = rpcData as { ok?: boolean; duplicate?: boolean };
    return json({ received: true, fulfilled: result?.ok === true, duplicate: result?.duplicate === true });
  } catch (e) {
    console.error('[whopWebhook]', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
