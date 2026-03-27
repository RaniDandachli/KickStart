import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';
import { getSupabase } from '@/supabase/client';

const mockBadges = [
  { id: '1', name: 'Streak Starter', earned: true },
  { id: '2', name: 'Cosmetic Collector', earned: false },
];

const mockHistory = [
  { id: 'h1', label: 'Win vs NeoStriker', when: 'Yesterday' },
  { id: 'h2', label: 'Loss vs GoalRush', when: '2d ago' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const { data: profile, isLoading } = useProfile(uid);

  async function signOut() {
    if (ENABLE_BACKEND) {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    }
    useAuthStore.getState().signOutLocal();
    router.replace(ENABLE_BACKEND ? '/(auth)/sign-in' : '/(app)/(tabs)');
  }

  return (
    <Screen>
      <View className="mb-4 flex-row items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-full border border-dashed border-white/30 bg-ink-800">
          <Text className="text-2xl">🧤</Text>
        </View>
        <View className="flex-1">
          {isLoading ? (
            <SkeletonBlock className="h-6 w-40" />
          ) : (
            <>
              <Text className="text-2xl font-black text-white">{profile?.username ?? 'Player'}</Text>
              <Text className="text-sm text-white/50">{profile?.display_name}</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                <Badge label={`${profile?.credits ?? 0} CR`} tone="neon" />
                <Badge label={`${profile?.gems ?? 0} gems`} />
                {profile?.role && profile.role !== 'user' ? (
                  <Badge label={profile.role} tone="warning" />
                ) : null}
                {profile?.suspended_until ? <Badge label="Suspended" tone="danger" /> : null}
                {profile?.cheating_review_flag ? <Badge label="Review" tone="warning" /> : null}
              </View>
            </>
          )}
        </View>
      </View>

      <Card className="mb-4">
        <Text className="mb-2 font-bold text-white">Stats</Text>
        <Text className="text-sm text-white/60">Hydrate from `user_stats` + `ratings` after sync.</Text>
      </Card>

      <Text className="mb-2 text-lg font-bold text-white">Match history</Text>
      {mockHistory.map((h) => (
        <View
          key={h.id}
          className="mb-2 rounded-xl border border-white/10 bg-ink-800/80 px-3 py-2"
        >
          <Text className="text-white">{h.label}</Text>
          <Text className="text-xs text-white/40">{h.when}</Text>
        </View>
      ))}

      <Text className="mb-2 mt-4 text-lg font-bold text-white">Achievements</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {mockBadges.map((b) => (
          <Badge key={b.id} label={b.name} tone={b.earned ? 'success' : 'default'} />
        ))}
      </View>

      <Card className="mb-4">
        <Text className="font-semibold text-white">Owned cosmetics</Text>
        <Text className="mt-1 text-sm text-white/60">TODO: query `user_cosmetics` join `cosmetics`.</Text>
      </Card>

      <Card className="mb-4">
        <Text className="font-semibold text-white">KickClash Plus</Text>
        <Text className="mt-1 text-sm text-white/60">
          Subscription placeholder — Stripe scaffold via Edge `syncSubscriptionStatus`.
        </Text>
      </Card>

      <AppButton title="Settings" variant="secondary" onPress={() => router.push('/(app)/(tabs)/profile/settings')} />
      <AppButton className="mt-2" title="Transaction history" variant="ghost" onPress={() => router.push('/(app)/(tabs)/profile/transactions')} />
      <AppButton className="mt-2" title="Sign out" variant="danger" onPress={() => void signOut()} />
    </Screen>
  );
}
