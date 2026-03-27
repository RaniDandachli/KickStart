import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';

export default function PlayHubScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Text className="mb-2 text-3xl font-black text-neon-lime">Play</Text>
      <Text className="mb-6 text-sm text-white/60">Matchmaking is mocked — adapters ready for Supabase Realtime.</Text>
      <Card className="mb-4">
        <QueueRow
          title="Casual queue"
          body="Unrated practice. No MMR update."
          onPress={() => router.push('/(app)/(tabs)/play/casual')}
        />
        <QueueRow
          title="Ranked queue"
          body="Elo-style updates — see `utils/rating`."
          onPress={() => router.push('/(app)/(tabs)/play/ranked')}
        />
        <QueueRow
          title="Custom room"
          body="Invite codes — TODO multiplayer ticket service."
          onPress={() => router.push('/(app)/(tabs)/play/custom')}
        />
      </Card>
    </Screen>
  );
}

function QueueRow({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <View className="mb-4 border-b border-white/10 pb-4 last:mb-0 last:border-b-0 last:pb-0">
      <Text className="text-lg font-bold text-white">{title}</Text>
      <Text className="mb-2 text-sm text-white/60">{body}</Text>
      <AppButton title="Queue" variant="secondary" onPress={onPress} />
    </View>
  );
}
