import { useState } from 'react';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';

export default function CustomRoomScreen() {
  const [code, setCode] = useState('');
  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Custom room</Text>
      <Card>
        <Text className="mb-2 text-sm text-slate-600">
          TODO: Exchange join codes via Edge Function + `match_sessions` custom mode.
        </Text>
        <KCTextInput label="Room code" autoCapitalize="characters" value={code} onChangeText={setCode} />
        <AppButton title="Join room (stub)" variant="secondary" onPress={() => {}} />
      </Card>
    </Screen>
  );
}
