import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useAuthStore } from '@/store/authStore';

export default function MatchResultScreen() {
  const { matchId, winner, sa, sb } = useLocalSearchParams<{
    matchId: string;
    winner?: string;
    sa?: string;
    sb?: string;
  }>();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id ?? 'local-player');
  const won = winner === uid;

  return (
    <Screen>
      <Text className="mb-4 text-3xl font-black text-white">{won ? 'Victory!' : 'Defeat'}</Text>
      <Card className="mb-4">
        <Text className="text-sm text-white/60">Match</Text>
        <Text className="font-mono text-neon-lime">{matchId}</Text>
        <Text className="mt-4 text-lg text-white">
          Score {sa ?? '?'} — {sb ?? '?'}
        </Text>
        <Text className="mt-2 text-sm text-white/50">
          TODO: Call `recordMatchResult` Edge Function to write `match_results` + ranked delta when verified.
        </Text>
      </Card>
      <View className="gap-2">
        <AppButton title="Back to Play" onPress={() => router.replace('/(app)/(tabs)/play')} />
        <AppButton title="Home" variant="secondary" onPress={() => router.replace('/(app)/(tabs)')} />
      </View>
    </Screen>
  );
}
