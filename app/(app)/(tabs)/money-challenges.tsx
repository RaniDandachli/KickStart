import { Redirect } from 'expo-router';

import { dailyRaceHref } from '@/lib/tabRoutes';

/** Old bottom-tab route → Daily Race lives under Events now. */
export default function LegacyMoneyTabRedirect() {
  return <Redirect href={dailyRaceHref()} />;
}
