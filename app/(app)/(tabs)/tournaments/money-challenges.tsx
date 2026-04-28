import { Redirect } from 'expo-router';

import { moneyChallengesHref } from '@/lib/tabRoutes';

/** Old path under Events → top-level Money tab. */
export default function LegacyMoneyChallengesRedirect() {
  return <Redirect href={moneyChallengesHref()} />;
}
