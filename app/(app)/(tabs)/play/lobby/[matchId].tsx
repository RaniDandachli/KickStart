import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useAuthStore } from '@/store/authStore';

export default function PreMatchLobbyScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const self = useAuthStore((s) => s.user?.id ?? 'you');

  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Pre-match lobby</Text>
      <Card className="mb-4">
        <Text className="text-sm text-slate-600">Session</Text>
        <Text className="text-lg font-mono text-emerald-600">{matchId}</Text>
      </Card>
      <View className="flex-row gap-3">
        <PlayerTile label="You" sub={self} />
        <PlayerTile label="Opponent" sub="Resolved from Supabase later" />
      </View>
      <Text className="my-4 text-sm text-slate-300">
        TODO: Ready-check + cosmetics loadout + latency badge. Starting drops you into the gameplay stub.
      </Text>
      <AppButton title="Start prototype match" onPress={() => router.push(`/(app)/(tabs)/play/match/${matchId}`)} />
    </Screen>
  );
}

function PlayerTile({ label, sub }: { label: string; sub: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <Text className="text-xs uppercase text-slate-500">{label}</Text>
      <Text className="text-base font-semibold text-slate-900">{sub}</Text>
    </View>
  );
}
