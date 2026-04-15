import { Text } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { env } from '@/lib/env';
import { openPrivacyPolicy, openTermsOfService } from '@/lib/legalLinks';
import { SKILL_CONTEST_ENTRY_SHORT, SKILL_CONTEST_OPERATOR_PRIZE } from '@/lib/skillContestCopy';

export default function LegalScreen() {
  const termsHosted = Boolean(env.EXPO_PUBLIC_TERMS_URL?.trim());
  const privacyHosted = Boolean(env.EXPO_PUBLIC_PRIVACY_URL?.trim());

  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Legal</Text>
      <Card className="mb-4">
        <Text className="mb-2 text-sm text-slate-300">
          Run It offers skill-based contests. {SKILL_CONTEST_OPERATOR_PRIZE} {SKILL_CONTEST_ENTRY_SHORT}
        </Text>
        <Text className="text-sm text-slate-300">
          Full Terms of Service and Privacy Policy are available in the app below. Review them with counsel—especially for paid contests
          and users in multiple states or countries.
        </Text>
      </Card>
      <AppButton className="mb-2" title="Terms of service" variant="secondary" onPress={() => void openTermsOfService()} />
      <AppButton className="mb-4" title="Privacy policy" variant="secondary" onPress={() => void openPrivacyPolicy()} />
      {termsHosted || privacyHosted ? (
        <Text className="text-xs text-slate-500">
          Opening terms or privacy may use your website in the browser when that&apos;s configured for this build.
        </Text>
      ) : (
        <Text className="text-xs text-slate-500">
          The full text is shown in the app above. Your operator can also host matching pages on the web if they choose.
        </Text>
      )}
    </Screen>
  );
}
