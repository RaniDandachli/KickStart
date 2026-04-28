/**
 * Moves cash from the user's in-app wallet to their Whop connected company ledger (then they withdraw to bank via Whop).
 * Debits `profiles.wallet_cents` first, then calls Whop POST /transfers; restores wallet if Whop fails.
 *
 * Requires: WHOP_COMPANY_API_KEY with `payout:transfer_funds`, WHOP_PARENT_COMPANY_ID (platform `biz_…` origin),
 * and sufficient **platform** balance on Whop (top up in Whop dashboard).
 *
 * Deploy: `npx supabase functions deploy withdrawWalletToWhop`
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import {
  assertPayoutMeansMinimumBankTransfer,
  fetchWithdrawPlatformFeeBps,
  splitWithdrawGrossCents,
} from '../_shared/walletWithdrawFee.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';
import { whopTransfersCreate } from '../_shared/whopRest.ts';

const Body = z.object({
  amount_cents: z.number().int().min(100),
  idempotency_key: z.string().min(8).max(200),
});

function centsToUsdAmount(amountCents: number): number {
  return Math.round(amountCents) / 100;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const whopKey = Deno.env.get('WHOP_COMPANY_API_KEY')?.trim();
    const parentId = Deno.env.get('WHOP_PARENT_COMPANY_ID')?.trim();
    if (!whopKey || !parentId) {
      return errorResponse('Whop is not configured (WHOP_COMPANY_API_KEY / WHOP_PARENT_COMPANY_ID)', 503);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return errorResponse('Unauthorized', 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const userId = userData.user.id;
    const { amount_cents, idempotency_key } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    const feeBps = await fetchWithdrawPlatformFeeBps(admin);
    const split = splitWithdrawGrossCents(amount_cents, feeBps);
    const payoutErr = assertPayoutMeansMinimumBankTransfer(split.payoutCents, split.feeCents);
    if (payoutErr) return errorResponse(payoutErr, 422);

    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('wallet_cents, whop_company_id')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profile) return errorResponse('Profile not found', 404);

    const whopCompanyId = profile.whop_company_id as string | null;
    const wallet = Number(profile.wallet_cents ?? 0);

    if (!whopCompanyId) {
      return errorResponse('Open Whop payouts and create a connected account before withdrawing.', 400);
    }
    if (wallet < amount_cents) {
      return errorResponse('Insufficient wallet balance', 400);
    }

    const newBal = wallet - amount_cents;
    const { data: debited, error: debitErr } = await admin
      .from('profiles')
      .update({ wallet_cents: newBal, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('wallet_cents', wallet)
      .select('wallet_cents')
      .maybeSingle();

    if (debitErr || !debited) {
      return errorResponse('Balance changed — try again.', 409);
    }

    const whopIdempotence = `withdraw_whop_${userId}_${idempotency_key}`.slice(0, 200);
    /** User receives this amount net; remainder is platform withhold (Stripe/Whop parent balance retains margin vs gross debit). */
    const usdAmount = centsToUsdAmount(split.payoutCents);

    try {
      const transfer = await whopTransfersCreate(whopKey, {
        amount: usdAmount,
        currency: 'usd',
        origin_id: parentId,
        destination_id: whopCompanyId,
        idempotence_key: whopIdempotence,
        metadata: {
          user_id: userId,
          idempotency_key,
          source: 'withdraw_wallet_to_whop',
          gross_wallet_debit_cents: String(amount_cents),
          platform_fee_cents: String(split.feeCents),
          net_destination_usd_approx: String(usdAmount),
        },
        notes: split.feeCents > 0
          ? `Wallet cash-out (${(split.feeCents / 100).toFixed(2)} USD fee retained)`
          : 'Wallet cash-out',
      });

      const { error: txErr } = await admin.from('transactions').insert({
        user_id: userId,
        kind: 'wallet_withdraw',
        amount: amount_cents,
        currency: 'wallet_cents',
        description:
          split.feeCents > 0
            ? `Withdraw to Whop (${(split.feeCents / 100).toFixed(2)} USD platform fee)`
            : 'Withdraw to Whop connected account',
        metadata: {
          whop_transfer_id: transfer.id,
          idempotency_key,
          destination_whop_company_id: whopCompanyId,
          gross_wallet_debit_cents: amount_cents,
          net_destination_cents: split.payoutCents,
          platform_fee_cents: split.feeCents,
        },
      });

      if (txErr) {
        console.error('[withdrawWalletToWhop] transaction row failed', txErr);
      }

      if (split.feeCents > 0) {
        const { error: platErr } = await admin.rpc('platform_credit_withdraw_fee_revenue', {
          p_cents: split.feeCents,
        });
        if (platErr) console.error('[withdrawWalletToWhop] platform rollup failed', platErr);
      }

      return json({
        ok: true,
        wallet_cents: debited.wallet_cents as number,
        whop_transfer_id: transfer.id,
        gross_wallet_debit_cents: amount_cents,
        net_destination_cents: split.payoutCents,
        platform_fee_cents: split.feeCents,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const { error: restoreErr } = await admin
        .from('profiles')
        .update({ wallet_cents: wallet, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .eq('wallet_cents', newBal);

      if (restoreErr) {
        console.error('[withdrawWalletToWhop] CRITICAL: wallet restore failed after Whop error', restoreErr, msg);
      }

      if (/insufficient|balance|funds/i.test(msg)) {
        return errorResponse(
          'Whop platform balance may be insufficient for this transfer. Try a smaller amount, top up your Whop platform balance, or contact support.',
          502,
        );
      }
      return errorResponse(msg, 400);
    }
  } catch (e) {
    console.error('[withdrawWalletToWhop]', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
