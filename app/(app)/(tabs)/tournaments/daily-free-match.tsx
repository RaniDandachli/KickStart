import { Redirect } from 'expo-router';

/** Legacy route — bracket play now lives on `daily-free-play`. */
export default function DailyFreeTournamentMatchRedirect() {
  return <Redirect href="/(app)/(tabs)/tournaments/daily-free-play" />;
}
