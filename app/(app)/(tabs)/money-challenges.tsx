import { Redirect } from 'expo-router';

import { dailyRaceHref } from '@/lib/tabRoutes';

/** Old bottom-tab route → 1v1 Challenges lives under Events now. */
export default function LegacyMoneyTabRedirect() {
  return <Redirect href={dailyRaceHref()} />;
}
