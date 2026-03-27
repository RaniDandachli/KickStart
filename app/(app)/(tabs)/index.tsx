import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { useActiveSeason } from '@/hooks/useActiveSeason';
import { mockRecentMatches } from '@/lib/mockHome';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';
import { useTournaments } from '@/hooks/useTournaments';
import { formatEntryType, formatTournamentState } from '@/features/tournaments/tournamentPresentation';

export default function HomeScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const seasonQ = useActiveSeason();
  const tournamentsQ = useTournaments(true);

  const profile = profileQ.data;
  const showSkeleton = profileQ.isLoading && !profile;

  const nextTournament = tournamentsQ.data?.[0];

  return (
    <Screen>
      <Text className="mb-1 text-xs uppercase tracking-widest text-neon-cyan">KickClash</Text>
      {showSkeleton ? (
        <SkeletonBlock className="mb-4 h-10 w-2/3" />
      ) : (
        <Text className="mb-4 text-3xl font-black text-white">
          Hey {profile?.display_name ?? profile?.username ?? 'Rookie'} 👟
        </Text>
      )}

      <View className="mb-4 flex-row gap-3">
        <Card className="flex-1">
          <Text className="text-xs text-white/50">Ranked rating</Text>
          <Text className="text-2xl font-bold text-neon-lime">{(profile?.credits ?? 0) > 500 ? '1,612' : '—'}</Text>
          <Text className="text-xs text-white/40">TODO: join `ratings` row</Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-xs text-white/50">MMR tier</Text>
          <Text className="text-xl font-bold text-white">Challenger III</Text>
          <Badge label="Seasonal" tone="neon" />
        </Card>
      </View>

      <Card className="mb-4">
        <Text className="mb-2 text-sm font-bold text-white">Quick stats</Text>
        <View className="flex-row justify-between">
          <Stat label="Wins" value="—" />
          <Stat label="Losses" value="—" />
          <Stat label="Streak" value="—" />
        </View>
        <Text className="mt-2 text-xs text-white/40">Hydrate from `user_stats` after first Supabase sync.</Text>
      </Card>

      <Text className="mb-2 text-lg font-bold text-white">Upcoming tournaments</Text>
      {tournamentsQ.isLoading ? (
        <SkeletonBlock className="mb-4 h-24" />
      ) : nextTournament ? (
        <Card className="mb-4 border-neon-lime/30">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="flex-1 pr-2 text-base font-bold text-white">{nextTournament.name}</Text>
            <Badge label={formatTournamentState(nextTournament.state)} tone="warning" />
          </View>
          <Text className="text-sm text-white/60">{formatEntryType(nextTournament.entry_type)}</Text>
          <Text className="mt-1 text-xs text-white/40" numberOfLines={2}>
            {nextTournament.prize_description}
          </Text>
        </Card>
      ) : (
        <EmptyState
          title="No open tournaments"
          description="Seed SQL or create one via admin Edge Function."
          actionLabel="Browse all"
          onAction={() => router.push('/(app)/(tabs)/tournaments')}
        />
      )}

      <Text className="mb-2 text-lg font-bold text-white">Current season</Text>
      <Card className="mb-4">
        {seasonQ.isLoading ? (
          <SkeletonBlock className="h-6" />
        ) : seasonQ.data ? (
          <>
            <Text className="text-lg font-bold text-white">{seasonQ.data.name}</Text>
            <Text className="text-sm text-white/60">Ends {new Date(seasonQ.data.ends_at).toLocaleDateString()}</Text>
          </>
        ) : (
          <Text className="text-sm text-white/50">No active season row — run seed SQL.</Text>
        )}
      </Card>

      <Text className="mb-2 text-lg font-bold text-white">Recent results</Text>
      {(mockRecentMatches as { id: string; result: string; score: string; mode: string; ago: string }[]).map((m) => (
        <View
          key={m.id}
          className="mb-2 flex-row items-center justify-between rounded-xl border border-white/10 bg-ink-800 px-3 py-2"
        >
          <Text className="text-white">
            {m.mode} · {m.score}
          </Text>
          <Badge label={m.result === 'W' ? 'Win' : 'Loss'} tone={m.result === 'W' ? 'success' : 'danger'} />
          <Text className="text-xs text-white/40">{m.ago}</Text>
        </View>
      ))}

      <View className="mt-6 gap-2">
        <AppButton title="Play now" onPress={() => router.push('/(app)/(tabs)/play')} />
        <AppButton
          title="Join tournament"
          variant="secondary"
          onPress={() => router.push(`/(app)/(tabs)/tournaments?highlight=${nextTournament?.id ?? ''}`)}
        />
        <AppButton
          title="View leaderboard"
          variant="ghost"
          onPress={() => router.push('/(app)/(tabs)/leaderboard')}
        />
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs text-white/50">{label}</Text>
      <Text className="text-lg font-bold text-white">{value}</Text>
    </View>
  );
}
