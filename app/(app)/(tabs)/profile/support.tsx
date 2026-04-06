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
      Alert.alert(
        'Support',
        'Set EXPO_PUBLIC_SUPPORT_CONTACT in your environment (email or https help URL).',
      );
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
        <Text className="text-sm text-slate-600">
          For match disputes, use Profile → Dispute a match. For payments, prizes, or account issues, contact the operator
          through the channel below once it is configured for production.
        </Text>
      </Card>
      {configured ? (
        <Text className="mb-3 text-xs text-slate-500">Contact: {env.EXPO_PUBLIC_SUPPORT_CONTACT}</Text>
      ) : (
        <Text className="mb-3 text-xs text-amber-700">
          Support contact is not configured (set EXPO_PUBLIC_SUPPORT_CONTACT).
        </Text>
      )}
      <AppButton title={configured ? 'Open support' : 'Support not configured'} onPress={() => void openSupport()} />
    </Screen>
  );
}
