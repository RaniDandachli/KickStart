import { Text } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';

export default function SupportScreen() {
  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Support</Text>
      <Card>
        <Text className="text-sm text-white/70">
          TODO: Link help center / email / in-app ticket via moderation tools.
        </Text>
      </Card>
    </Screen>
  );
}
