import { Redirect } from 'expo-router';

/** Stripe payouts were removed — Whop is the sole payout rail. */
export default function StripeConnectRedirect() {
  return <Redirect href="/(app)/(tabs)/profile/whop-payouts" />;
}
