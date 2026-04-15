import { Alert, Linking, Text } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { env, supportContactHref } from '@/lib/env';

export default function SupportScreen() {
  const href = supportContactHref();
  const configured = Boolean(href);

  async function openSupport() {
    if (!href) {
      Alert.alert('Support', 'Support contact isn’t set up for this build yet. Try again after an update.');
      return;
    }
    const ok = await Linking.canOpenURL(href);
    if (!ok) {
      Alert.alert('Support', 'Cannot open this link on this device.');
      return;
    }
    await Linking.openURL(href);
  }

  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Support</Text>
      <Card className="mb-4">
        <Text className="text-sm text-slate-300">
          For match disputes, use Profile → Dispute a match. For payments, prizes, or account issues, use the contact option below when
          it&apos;s available.
        </Text>
      </Card>
      {configured ? (
        <Text className="mb-3 text-sm text-slate-300">Contact: {env.EXPO_PUBLIC_SUPPORT_CONTACT}</Text>
      ) : (
        <Text className="mb-3 text-sm text-amber-200/90">Support email or link will appear here once your operator turns it on.</Text>
      )}
      <AppButton title={configured ? 'Open support' : 'Support not configured'} onPress={() => void openSupport()} />
    </Screen>
  );
}
