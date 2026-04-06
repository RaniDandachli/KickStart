import { Alert, Linking, Text } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SKILL_CONTEST_ENTRY_SHORT, SKILL_CONTEST_OPERATOR_PRIZE } from '@/lib/skillContestCopy';
import { env } from '@/lib/env';

async function tryOpen(url: string | undefined, label: string) {
  if (!url) {
    Alert.alert(label, 'Set the URL in EXPO_PUBLIC environment variables for production.');
    return;
  }
  const ok = await Linking.canOpenURL(url);
  if (!ok) {
    Alert.alert(label, 'Cannot open this link.');
    return;
  }
  await Linking.openURL(url);
}

export default function LegalScreen() {
  const terms = env.EXPO_PUBLIC_TERMS_URL;
  const privacy = env.EXPO_PUBLIC_PRIVACY_URL;
  const hasUrls = Boolean(terms && privacy);

  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Legal</Text>
      <Card className="mb-4">
        <Text className="mb-2 text-sm text-slate-600">
          Run It offers skill-based contests. {SKILL_CONTEST_OPERATOR_PRIZE} {SKILL_CONTEST_ENTRY_SHORT}
        </Text>
        <Text className="text-sm text-slate-600">
          Official terms, privacy policy, age requirements, and regional eligibility must be drafted and hosted by your counsel —
          then linked here via environment variables.
        </Text>
      </Card>
      <AppButton className="mb-2" title="Terms of service" variant="secondary" onPress={() => void tryOpen(terms, 'Terms')} />
      <AppButton className="mb-4" title="Privacy policy" variant="secondary" onPress={() => void tryOpen(privacy, 'Privacy')} />
      {!hasUrls ? (
        <Text className="text-xs text-amber-700">
          Set EXPO_PUBLIC_TERMS_URL and EXPO_PUBLIC_PRIVACY_URL for production builds.
        </Text>
      ) : null}
    </Screen>
  );
}
