import { Redirect } from 'expo-router';

import { moneyChallengesHref } from '@/lib/tabRoutes';

/** @deprecated Prefer Money Challenges hub (same taps + pool targets). */
export default function SoloChallengesRedirect() {
  return <Redirect href={moneyChallengesHref()} />;
}
