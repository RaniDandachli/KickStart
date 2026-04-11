import { Text } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { env } from '@/lib/env';
import { openPrivacyPolicy, openTermsOfService } from '@/lib/legalLinks';
import { SKILL_CONTEST_ENTRY_SHORT, SKILL_CONTEST_OPERATOR_PRIZE } from '@/lib/skillContestCopy';

export default function LegalScreen() {
  const terms = env.EXPO_PUBLIC_TERMS_URL;
  const privacy = env.EXPO_PUBLIC_PRIVACY_URL;
  const hasUrls = Boolean(terms?.trim() && privacy?.trim());

  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Legal</Text>
      <Card className="mb-4">
        <Text className="mb-2 text-sm text-slate-600">
          Run It offers skill-based contests. {SKILL_CONTEST_OPERATOR_PRIZE} {SKILL_CONTEST_ENTRY_SHORT}
        </Text>
        <Text className="text-sm text-slate-600">
          RuniT Arcade’s official terms and privacy policy are linked below. Host the documents you publish and set the URLs in your
          environment for production builds.
        </Text>
      </Card>
      <AppButton className="mb-2" title="Terms of service" variant="secondary" onPress={() => void openTermsOfService()} />
      <AppButton className="mb-4" title="Privacy policy" variant="secondary" onPress={() => void openPrivacyPolicy()} />
      {!hasUrls ? (
        <Text className="text-xs text-amber-700">
          Set EXPO_PUBLIC_TERMS_URL and EXPO_PUBLIC_PRIVACY_URL for production builds.
        </Text>
      ) : null}
    </Screen>
  );
}
