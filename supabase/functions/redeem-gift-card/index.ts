/**
 * Redeem a gift card reward: atomic RPC + service-role code fetch + Resend email.
 * Gift codes never appear in client responses or logs.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';
import { sendGiftCardEmailWithRetry } from '../_shared/resendGiftCard.ts';

const Body = z.object({
  rewardKey: z.string().min(1).max(200),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

type RpcResult = {
  ok?: boolean;
  error?: string;
  redemption_id?: string;
  duplicate?: boolean;
  redeem_tickets_balance?: number;
};

/** Prefer SUPPORT_EMAIL secret; else support@<sending-domain> from RESEND_FROM_EMAIL (never example.com). */
function deriveSupportEmail(fromHeader: string, configured: string | undefined): string {
  const c = configured?.trim();
  if (c) return c;
  const m = fromHeader.match(/<([^>]+)>/);
  const addr = (m?.[1] ?? fromHeader).trim();
  const at = addr.lastIndexOf('@');
  if (at > 0 && at < addr.length - 1) {
    const domain = addr.slice(at + 1).trim();
    if (domain && !/[\s<>]/.test(domain)) return `support@${domain}`;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return addr;
  console.error('[redeem-gift-card] Set SUPPORT_EMAIL secret; could not parse domain from FROM.');
  return addr;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? Deno.env.get('FROM_EMAIL');
    const supportEmail = deriveSupportEmail(fromEmail, Deno.env.get('SUPPORT_EMAIL'));
    const brandName = Deno.env.get('BRAND_NAME')?.trim() || 'Run It Arcade';
    const logoUrl =
      Deno.env.get('EMAIL_LOGO_URL')?.trim() || Deno.env.get('BRAND_LOGO_URL')?.trim() || null;

    if (!resendKey || !fromEmail) {
      console.error('[redeem-gift-card] Missing RESEND_API_KEY or RESEND_FROM_EMAIL/FROM_EMAIL');
      return errorResponse('Server email not configured', 503);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return errorResponse('Unauthorized', 401);

    const user = userData.user;
    const email = user.email;
    if (!email) {
      return errorResponse('Your account needs an email address to receive gift card codes.', 400);
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const { rewardKey, idempotencyKey } = parsed.data;

    const { data: rpcData, error: rpcErr } = await userClient.rpc('redeem_gift_card_offer', {
      p_reward_key: rewardKey.trim(),
      p_idempotency_key: idempotencyKey?.trim() ?? null,
    });

    if (rpcErr) {
      console.error('[redeem-gift-card] RPC error:', rpcErr.message);
      return errorResponse(rpcErr.message, 500);
    }

    const rpc = rpcData as RpcResult;
    if (!rpc?.ok) {
      const code = rpc?.error ?? 'unknown';
      const friendly =
        code === 'insufficient_balance'
          ? 'Not enough redeem tickets.'
          : code === 'out_of_stock'
            ? 'This reward is temporarily out of stock. Try again later.'
            : code === 'not_found'
              ? 'This reward is not available.'
              : code === 'prize_not_configured'
                ? 'This reward is not set up in the catalog.'
                : code === 'catalog_mismatch'
                  ? 'Catalog configuration error. Contact support.'
                  : 'Could not complete redemption.';
      // 200 + ok:false so supabase-js invoke returns a parseable body (non-2xx often drops JSON).
      return json({ ok: false, error: code, message: friendly }, 200);
    }

    const redemptionId = rpc.redemption_id;
    if (!redemptionId) {
      return errorResponse('Invalid server response', 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: redemption, error: redErr } = await admin
      .from('prize_redemptions')
      .select('id, email_status, gift_card_inventory_id, user_id')
      .eq('id', redemptionId)
      .maybeSingle();

    if (redErr || !redemption?.gift_card_inventory_id) {
      console.error('[redeem-gift-card] Missing redemption or gift row after RPC');
      return errorResponse('Redemption incomplete — contact support with your account email.', 500);
    }

    if (redemption.user_id !== user.id) {
      return errorResponse('Forbidden', 403);
    }

    if (redemption.email_status === 'sent') {
      return json({
        ok: true,
        message: 'Your gift card has been sent to your email.',
        duplicate: !!rpc.duplicate,
        redeem_tickets_balance: rpc.redeem_tickets_balance,
      });
    }

    const { data: gcRow, error: gcErr } = await admin
      .from('gift_card_inventory')
      .select('code, pin, reward_name')
      .eq('id', redemption.gift_card_inventory_id)
      .maybeSingle();

    if (gcErr || !gcRow?.code) {
      console.error('[redeem-gift-card] Could not load inventory row (no code logged)');
      await admin
        .from('prize_redemptions')
        .update({
          email_status: 'failed',
          email_error: 'inventory_fetch_failed',
          email_to: email,
        })
        .eq('id', redemptionId);
      return errorResponse('Could not load your code — support has been notified.', 500);
    }

    const sendResult = await sendGiftCardEmailWithRetry(resendKey, fromEmail, {
      to: email,
      rewardName: gcRow.reward_name,
      code: gcRow.code,
      pin: gcRow.pin ?? null,
      supportEmail,
      brandName,
      logoUrl,
    });

    if (sendResult.ok) {
      await admin
        .from('prize_redemptions')
        .update({
          email_to: email,
          email_status: 'sent',
          email_error: null,
        })
        .eq('id', redemptionId);
    } else {
      await admin
        .from('prize_redemptions')
        .update({
          email_to: email,
          email_status: 'failed',
          email_error: sendResult.error.slice(0, 2000),
        })
        .eq('id', redemptionId);
      return json(
        {
          ok: true,
          partial: true,
          message:
            'Your reward is confirmed, but we could not send the email yet. Our team will retry — check your spam folder or contact support.',
          redemption_id: redemptionId,
          redeem_tickets_balance: rpc.redeem_tickets_balance,
        },
        200,
      );
    }

    return json({
      ok: true,
      message: 'Your gift card has been sent to your email.',
      duplicate: !!rpc.duplicate,
      redeem_tickets_balance: rpc.redeem_tickets_balance,
    });
  } catch (e) {
    console.error('[redeem-gift-card]', e instanceof Error ? e.message : e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
