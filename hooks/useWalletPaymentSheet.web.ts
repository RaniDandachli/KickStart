import { useCallback } from 'react';

/**
 * Web bundle: no `@stripe/stripe-react-native`. Use hosted Checkout or a web Stripe integration.
 */
export function useWalletPaymentSheet() {
  const payWallet = useCallback(async (_amountCents: number): Promise<boolean> => {
    throw new Error('Use web checkout from the browser flow.');
  }, []);

  const payCredits = useCallback(async (_packageId: string): Promise<boolean> => {
    throw new Error('Use web checkout from the browser flow.');
  }, []);

  return { payWallet, payCredits };
}
