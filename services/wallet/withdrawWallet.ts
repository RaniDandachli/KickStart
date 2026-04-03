import { FunctionsHttpError } from '@supabase/functions-js';

import { getSupabase } from '@/supabase/client';

async function parseFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const j = (await error.context.json()) as { error?: string };
      if (j?.error) return j.error;
    } catch {
      /* ignore */
    }
  }
  return error instanceof Error ? error.message : 'Request failed';
}

export type WithdrawWalletResult = {
  ok: boolean;
  wallet_cents: number;
  stripe_transfer_id?: string;
  error?: string;
};

/**
 * Cash out wallet balance to the user's Stripe Connect account (Express → their bank per Stripe).
 */
export async function withdrawWalletToConnect(params: {
  amountCents: number;
  idempotencyKey: string;
}): Promise<WithdrawWalletResult> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    throw new Error('Sign in to withdraw.');
  }
  await supabase.auth.refreshSession();

  const { data, error } = await supabase.functions.invoke('withdrawWalletToConnect', {
    body: {
      amount_cents: params.amountCents,
      idempotency_key: params.idempotencyKey,
    },
  });

  if (error) {
    throw new Error(await parseFunctionError(error));
  }

  const payload = data as WithdrawWalletResult & { error?: string };
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.ok) throw new Error('Withdrawal failed');
  return payload;
}
