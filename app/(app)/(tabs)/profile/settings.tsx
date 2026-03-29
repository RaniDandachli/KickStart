import { useRouter } from 'expo-router';
import { Switch, Text, View } from 'react-native';
import { useState } from 'react';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';

export default function SettingsScreen() {
  const router = useRouter();
  const [pushMatch, setPushMatch] = useState(true);
  const [pushTournament, setPushTournament] = useState(true);

  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Settings</Text>
      <Card className="mb-4">
        <Text className="mb-3 font-semibold text-slate-900">Notifications</Text>
        <RowToggle label="Match invites" value={pushMatch} onValueChange={setPushMatch} />
        <RowToggle label="Tournament updates" value={pushTournament} onValueChange={setPushTournament} />
        <Text className="mt-2 text-xs text-slate-400">
          TODO: persist preferences → `notifications` + device tokens.
        </Text>
      </Card>
      <AppButton title="Dispute a match" variant="secondary" onPress={() => router.push('/(app)/(tabs)/profile/dispute')} />
      <AppButton className="mt-2" title="Legal" variant="ghost" onPress={() => router.push('/(app)/(tabs)/profile/legal')} />
      <AppButton className="mt-2" title="Support" variant="ghost" onPress={() => router.push('/(app)/(tabs)/profile/support')} />
    </Screen>
  );
}

function RowToggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-slate-900">{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}
