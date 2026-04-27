import { Redirect } from 'expo-router';

/** @deprecated Prefer Money Challenges hub (same taps + pool targets). */
export default function SoloChallengesRedirect() {
  return <Redirect href="/(app)/(tabs)/tournaments/money-challenges" />;
}
