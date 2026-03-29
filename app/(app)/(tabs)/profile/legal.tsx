import { Text } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';

export default function LegalScreen() {
  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Legal</Text>
      <Card>
        <Text className="text-sm text-slate-600">
          Placeholder for Terms, Privacy, Age gate, and prize eligibility copy. Run it does not operate cash wagering
          or pooled entry-fee prize pools.
        </Text>
      </Card>
    </Screen>
  );
}
