import { Redirect } from 'expo-router';

import { dailyRaceLeaderHref } from '@/lib/tabRoutes';

/** Legacy `/weekly-race` route — leaderboard UI is now branded Daily Race here. */
export default function WeeklyRaceRedirectRoute() {
  return <Redirect href={dailyRaceLeaderHref()} />;
}
