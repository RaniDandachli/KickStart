/**
 * Creates a Whop checkout configuration (hosted URL) for wallet top-up or arcade credit packs.
 * Metadata is verified again in whopWebhook before crediting balances.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';
import { whopCheckoutConfigurationsCreate } from '../_shared/whopRest.ts';

const MIN_WALLET_CENTS = 100;
const MAX_WALLET_CENTS = 50_000;

function walletProcessingFeeCents(walletCents: number): number {
  return Math.round(walletCents * 0.029) + 30;
}

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

function absolutePurchaseUrl(purchaseUrl: string): string {
  if (purchaseUrl.startsWith('http://') || purchaseUrl.startsWith('https://')) return purchaseUrl;
  const base = purchaseUrl.startsWith('/') ? 'https://whop.com' : 'https://whop.com/';
  return `${base}${purchaseUrl}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const whopKey = Deno.env.get('WHOP_COMPANY_API_KEY')?.trim();
    const companyId = Deno.env.get('WHOP_PARENT_COMPANY_ID')?.trim();
    if (!whopKey || !companyId) {
      return errorResponse('Whop checkout is not configured (WHOP_COMPANY_API_KEY / WHOP_PARENT_COMPANY_ID)', 503);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return errorResponse('Unauthorized', 401);

    const userId = userData.user.id;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const { kind, successUrl, cancelUrl } = parsed.data;
    let lineAmountCents: number;
    let productName: string;
    let walletCents = 0;
    let prizeCredits = 0;
    let productExternalId: string;

    if (kind === 'wallet') {
      const ac = parsed.data.amountCents;
      if (ac === undefined) return errorResponse('amountCents required for wallet top-up', 422);
      if (ac < MIN_WALLET_CENTS || ac > MAX_WALLET_CENTS) {
        return errorResponse(
          `Amount must be between $${(MIN_WALLET_CENTS / 100).toFixed(2)} and $${(MAX_WALLET_CENTS / 100).toFixed(2)}`,
          422,
        );
      }
      walletCents = ac;
      const feeCents = walletProcessingFeeCents(ac);
      lineAmountCents = ac + feeCents;
      productName = `Wallet deposit $${(ac / 100).toFixed(2)} + card processing`;
      productExternalId = `kc_wallet_${userId}_${ac}_${crypto.randomUUID().replace(/-/g, '')}`;
    } else {
      const pid = parsed.data.packageId;
      if (!pid) return errorResponse('packageId required for credit packs', 422);
      const pack = CREDIT_PACKAGES[pid];
      if (!pack) return errorResponse('Unknown credit package', 422);
      lineAmountCents = pack.priceCents;
      prizeCredits = pack.prizeCredits;
      productName = pack.name;
      productExternalId = `kc_pack_${pid}`;
    }

    const initialPriceUsd = lineAmountCents / 100;

    const meta: Record<string, string> = {
      user_id: userId,
      kind,
      wallet_cents: String(walletCents),
      processing_fee_cents: kind === 'wallet' ? String(walletProcessingFeeCents(walletCents)) : '0',
      prize_credits: String(prizeCredits),
      package_id: parsed.data.packageId ?? '',
      app: 'kickclash',
    };

    const { purchase_url } = await whopCheckoutConfigurationsCreate(whopKey, {
      mode: 'payment',
      plan: {
        company_id: companyId,
        currency: 'usd',
        plan_type: 'one_time',
        release_method: 'buy_now',
        initial_price: initialPriceUsd,
        title: productName,
        product: {
          external_identifier: productExternalId,
          title: productName,
          visibility: 'hidden',
        },
      },
      metadata: meta,
      redirect_url: successUrl,
      source_url: cancelUrl,
    });

    const url = absolutePurchaseUrl(purchase_url);
    return json({ ok: true, url });
  } catch (e) {
    console.error('[createWhopCheckoutSession]', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
