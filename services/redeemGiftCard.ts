import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';

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
  const { data, error } = await invokeEdgeFunction<RedeemGiftCardResult>('redeem-gift-card', {
    body: {
      rewardKey: params.rewardKey,
      idempotencyKey: params.idempotencyKey,
    },
  });

  if (error) {
    const msg = error instanceof Error ? error.message : 'Network error';
    if (msg === 'Sign in to continue.') {
      throw new Error('Sign in to redeem gift cards.');
    }
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
