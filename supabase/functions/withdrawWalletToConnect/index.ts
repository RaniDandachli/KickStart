/**
 * Moves cash from the user's in-app wallet to their Stripe Connect Express account (then to their bank per Stripe).
 * Requires sufficient **platform** Stripe balance — wallet top-ups should use Stripe so funds exist to transfer.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import {
  assertPayoutMeansMinimumBankTransfer,
  fetchWithdrawPlatformFeeBps,
  splitWithdrawGrossCents,
} from '../_shared/walletWithdrawFee.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  amount_cents: z.number().int().min(100),
  idempotency_key: z.string().min(8).max(200),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) return errorResponse('Stripe is not configured', 503);

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
    if (payoutErr) {
      return errorResponse(payoutErr, 422);
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });

    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('wallet_cents, stripe_connect_account_id')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profile) return errorResponse('Profile not found', 404);

    const connectId = profile.stripe_connect_account_id as string | null;
    const wallet = Number(profile.wallet_cents ?? 0);
    if (!connectId) {
      return errorResponse('Connect a bank account under Payouts before withdrawing.', 400);
    }
    if (wallet < amount_cents) {
      return errorResponse('Insufficient wallet balance', 400);
    }

    const acct = await stripe.accounts.retrieve(connectId);
    if (acct.payouts_enabled !== true) {
      return errorResponse('Complete Stripe payout setup (bank) before withdrawing.', 400);
    }

    const stripeIdempotency = `withdraw_${userId}_${idempotency_key}`.slice(0, 255);

    let transfer: Stripe.Transfer;
    try {
      transfer = await stripe.transfers.create(
        {
          amount: split.payoutCents,
          currency: 'usd',
          destination: connectId,
          metadata: {
            user_id: userId,
            idempotency_key,
            source: 'withdraw_wallet_to_connect',
            gross_wallet_debit_cents: String(amount_cents),
            platform_fee_cents: String(split.feeCents),
            net_to_destination_cents: String(split.payoutCents),
          },
        },
        { idempotencyKey: stripeIdempotency },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/insufficient/i.test(msg) || /balance/i.test(msg)) {
        return errorResponse(
          'Stripe platform balance is insufficient for this transfer. Try a smaller amount or contact support.',
          502,
        );
      }
      throw e;
    }

    const newBal = wallet - amount_cents;
    const { data: updated, error: updErr } = await admin
      .from('profiles')
      .update({ wallet_cents: newBal, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('wallet_cents', wallet)
      .select('wallet_cents')
      .maybeSingle();

    if (updErr || !updated) {
      try {
        await stripe.transfers.createReversal(transfer.id);
      } catch (revErr) {
        console.error('[withdrawWalletToConnect] CRITICAL: ledger update failed after transfer; reversal failed', revErr);
      }
      return errorResponse('Balance changed — try again. Your Stripe transfer was reversed.', 409);
    }

    const { error: txErr } = await admin.from('transactions').insert({
      user_id: userId,
      kind: 'wallet_withdraw',
      amount: amount_cents,
      currency: 'wallet_cents',
      description:
        split.feeCents > 0
          ? `Withdraw to bank (Stripe Connect · ${(split.feeCents / 100).toFixed(2)} USD platform fee)`
          : 'Withdraw to bank (Stripe Connect)',
      metadata: {
        stripe_transfer_id: transfer.id,
        idempotency_key,
        destination_connect_account: connectId,
        gross_wallet_debit_cents: amount_cents,
        net_to_destination_cents: split.payoutCents,
        platform_fee_cents: split.feeCents,
      },
    });

    if (txErr) {
      console.error('[withdrawWalletToConnect] transaction row failed', txErr);
    }

    if (split.feeCents > 0) {
      const { error: platErr } = await admin.rpc('platform_credit_withdraw_fee_revenue', {
        p_cents: split.feeCents,
      });
      if (platErr) {
        console.error('[withdrawWalletToConnect] platform revenue rollup failed', platErr);
      }
    }

    return json({
      ok: true,
      wallet_cents: updated.wallet_cents as number,
      stripe_transfer_id: transfer.id,
      gross_wallet_debit_cents: amount_cents,
      net_transfer_cents: split.payoutCents,
      platform_fee_cents: split.feeCents,
    });
  } catch (e) {
    console.error('[withdrawWalletToConnect]', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
