import { FunctionsHttpError } from '@supabase/functions-js';
import * as Linking from 'expo-linking';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

import { env } from '@/lib/env';
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

/**
 * In-app Stripe Payment Sheet (embedded). iOS/Android only — web uses hosted Checkout.
 * Requires EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY and a dev/production build (not all Expo Go setups).
 */
export function useWalletPaymentSheet() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const payWallet = useCallback(
    async (amountCents: number): Promise<boolean> => {
      if (Platform.OS === 'web') {
        throw new Error('Use web checkout from the browser flow.');
      }
      if (!env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
        throw new Error('Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env (Stripe Dashboard → Developers → API keys).');
      }

      const supabase = getSupabase();
      await supabase.auth.refreshSession();

      const { data, error } = await supabase.functions.invoke('createWalletPaymentIntent', {
        body: { kind: 'wallet', amountCents },
      });

      if (error) throw new Error(await parseFunctionError(error));

      const payload = data as {
        paymentIntentClientSecret?: string;
        error?: string;
      };
      if (payload?.error) throw new Error(payload.error);
      const clientSecret = payload?.paymentIntentClientSecret;
      if (!clientSecret) throw new Error('No PaymentIntent client secret');

      const returnURL = Linking.createURL('stripe-redirect');

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'RunitArcade',
        returnURL,
        allowsDelayedPaymentMethods: false,
      });

      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') return false;
        throw new Error(presentError.message);
      }

      return true;
    },
    [initPaymentSheet, presentPaymentSheet],
  );

  const payCredits = useCallback(
    async (packageId: string): Promise<boolean> => {
      if (Platform.OS === 'web') {
        throw new Error('Use web checkout from the browser flow.');
      }
      if (!env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
        throw new Error('Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.');
      }

      const supabase = getSupabase();
      await supabase.auth.refreshSession();

      const { data, error } = await supabase.functions.invoke('createWalletPaymentIntent', {
        body: { kind: 'credits', packageId },
      });

      if (error) throw new Error(await parseFunctionError(error));

      const payload = data as {
        paymentIntentClientSecret?: string;
        error?: string;
      };
      if (payload?.error) throw new Error(payload.error);
      const clientSecret = payload?.paymentIntentClientSecret;
      if (!clientSecret) throw new Error('No PaymentIntent client secret');

      const returnURL = Linking.createURL('stripe-redirect');

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'RunitArcade',
        returnURL,
        allowsDelayedPaymentMethods: false,
      });

      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') return false;
        throw new Error(presentError.message);
      }

      return true;
    },
    [initPaymentSheet, presentPaymentSheet],
  );

  return { payWallet, payCredits };
}
