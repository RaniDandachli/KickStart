import { getSupabase } from '@/supabase/client';

export type RedeemGiftCardResult = {
  ok: boolean;
  message?: string;
  duplicate?: boolean;
  partial?: boolean;
  redeem_tickets_balance?: number;
  error?: string;
};

/**
 * Calls Edge Function `redeem-gift-card` (never exposes raw codes to the client).
 * Requires authenticated session and RESEND_* secrets on the project.
 */
export async function redeemGiftCard(params: {
  rewardKey: string;
  idempotencyKey?: string;
}): Promise<RedeemGiftCardResult> {
  const supabase = getSupabase();
  const {
    data: { session: initial },
  } = await supabase.auth.getSession();
  if (!initial?.access_token) {
    throw new Error('Sign in to redeem gift cards.');
  }

  // Fresh access token — stale JWT is the most common cause of 401 on Edge Functions with verify_jwt.
  const { data: refreshed } = await supabase.auth.refreshSession();
  const session = refreshed.session ?? initial;
  if (!session.access_token) {
    throw new Error('Could not refresh your session. Sign in again, then retry.');
  }

  const { data, error } = await supabase.functions.invoke<RedeemGiftCardResult>('redeem-gift-card', {
    body: {
      rewardKey: params.rewardKey,
      idempotencyKey: params.idempotencyKey,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const msg = error.message || 'Network error';
    if (/401|Unauthorized|JWT/i.test(msg)) {
      throw new Error('Session expired or not signed in. Sign in again, then retry.');
    }
    throw new Error(msg);
  }

  const d = data as RedeemGiftCardResult | null;
  if (!d) {
    throw new Error('Empty response from server');
  }

  if (d.ok !== true) {
    throw new Error(d.message ?? d.error ?? 'Redemption failed');
  }

  return d;
}
