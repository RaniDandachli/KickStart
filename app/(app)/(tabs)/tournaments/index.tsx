import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { formatEntryType, formatFormat, formatTournamentState } from '@/features/tournaments/tournamentPresentation';
import { useTournaments } from '@/hooks/useTournaments';
export default function TournamentsListScreen() {
  const router = useRouter();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { data, isLoading, isError } = useTournaments(false);

  return (
    <Screen>
      <Text className="mb-4 text-2xl font-black text-white">Tournaments</Text>
      <Text className="mb-4 text-sm font-medium text-slate-300">
        Prizes are descriptive rewards or admin-awarded — never user-funded cash pools.
      </Text>
      {isLoading && (
        <>
          <SkeletonBlock className="mb-3 h-24" />
          <SkeletonBlock className="mb-3 h-24" />
        </>
      )}
      {isError && (
        <EmptyState
          title="Could not load events"
          description="Check Supabase URL/key in .env and RLS policies."
        />
      )}
      {data?.map((t) => {
        const isHi = highlight && t.id === highlight;
        return (
          <Card key={t.id} className={`mb-3 ${isHi ? 'border-2 border-emerald-400' : ''}`}>
            <View className="mb-2 flex-row flex-wrap items-center gap-2">
              <Text className="flex-1 text-lg font-bold text-slate-900">{t.name}</Text>
              <Badge label={formatTournamentState(t.state)} tone="warning" />
              <Badge label={formatEntryType(t.entry_type)} tone="neon" />
            </View>
            <Text className="text-xs text-slate-500">
              {formatFormat(t.format)} · {t.current_player_count}/{t.max_players} players
            </Text>
            {t.starts_at ? (
              <Text className="mt-1 text-xs text-slate-400">
                Starts {new Date(t.starts_at).toLocaleString()}
              </Text>
            ) : null}
            <Text className="mt-2 text-sm text-slate-600" numberOfLines={3}>
              {t.prize_description}
            </Text>
            <Text
              className="mt-3 text-xs font-bold text-sky-300"
              onPress={() => router.push(`/(app)/(tabs)/tournaments/${t.id}`)}
            >
              View details →
            </Text>
          </Card>
        );
      })}
      {!isLoading && !data?.length ? (
        <EmptyState title="No tournaments" description="Run seed SQL or call createTournament (admin)." />
      ) : null}
    </Screen>
  );
}
