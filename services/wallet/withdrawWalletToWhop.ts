import { FunctionsHttpError } from '@supabase/functions-js';

import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';

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

export type WithdrawWalletToWhopResult = {
  ok: boolean;
  wallet_cents: number;
  whop_transfer_id?: string;
  gross_wallet_debit_cents?: number;
  net_destination_cents?: number;
  platform_fee_cents?: number;
  error?: string;
};

/**
 * Cash out wallet balance to the user's Whop connected company ledger (platform transfer).
 */
export async function withdrawWalletToWhop(params: {
  amountCents: number;
  idempotencyKey: string;
}): Promise<WithdrawWalletToWhopResult> {
  const { data, error } = await invokeEdgeFunction('withdrawWalletToWhop', {
    body: {
      amount_cents: params.amountCents,
      idempotency_key: params.idempotencyKey,
    },
  });

  if (error) {
    if (error instanceof Error && error.message === 'Sign in to continue.') {
      throw new Error('Sign in to withdraw.');
    }
    throw new Error(await parseFunctionError(error));
  }

  const payload = data as WithdrawWalletToWhopResult & { error?: string };
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.ok) throw new Error('Withdrawal failed');
  return payload;
}
