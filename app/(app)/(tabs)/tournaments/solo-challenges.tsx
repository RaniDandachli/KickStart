import { Redirect } from 'expo-router';

import { dailyRaceHref } from '@/lib/tabRoutes';

/** @deprecated Prefer Daily Race hub (same taps + pool targets). */
export default function SoloChallengesRedirect() {
  return <Redirect href={dailyRaceHref()} />;
}
