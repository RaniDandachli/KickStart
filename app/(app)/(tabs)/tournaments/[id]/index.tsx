import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { formatEntryType, formatFormat, formatTournamentState } from '@/features/tournaments/tournamentPresentation';
import { useJoinTournament, useTournament, useTournamentRules } from '@/hooks/useTournaments';
import { useAuthStore } from '@/store/authStore';

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const tq = useTournament(id);
  const rq = useTournamentRules(id);
  const join = useJoinTournament(userId);

  const t = tq.data;

  function onJoin() {
    if (!t || !userId) return;
    if (t.state !== 'open' && t.state !== 'full') {
      Alert.alert('KickClash', 'Tournament is not accepting joins right now.');
      return;
    }
    join.mutate(t.id, {
      onSuccess: () => Alert.alert('You are in!', 'Entry recorded — brackets lock via admin workflow.'),
      onError: (e) => Alert.alert('Join failed', e.message),
    });
  }

  return (
    <Screen>
      {tq.isLoading && <SkeletonBlock className="mb-4 h-32" />}
      {!tq.isLoading && !t && <EmptyState title="Not found" />}
      {t ? (
        <>
          <View className="mb-3 flex-row flex-wrap gap-2">
            <Badge label={formatTournamentState(t.state)} tone="warning" />
            <Badge label={formatEntryType(t.entry_type)} tone="neon" />
            <Badge label={formatFormat(t.format)} />
          </View>
          <Text className="mb-2 text-2xl font-black text-white">{t.name}</Text>
          <Text className="mb-4 text-sm text-white/70">{t.description}</Text>
          <Card className="mb-4">
            <Row k="Prize" v={t.prize_description} />
            <Row k="Capacity" v={`Slots: ${t.current_player_count} / ${t.max_players}`} />
            <Row
              k="Entry"
              v={
                t.entry_type === 'credits'
                  ? `${t.entry_cost_credits} credits (non-cash)`
                  : formatEntryType(t.entry_type)
              }
            />
            {t.starts_at ? <Row k="Start" v={new Date(t.starts_at).toLocaleString()} /> : null}
            {t.rules_summary ? <Row k="Summary" v={t.rules_summary} /> : null}
          </Card>
          <Text className="mb-2 text-lg font-bold text-white">Rules</Text>
          {rq.data?.length ? (
            rq.data.map((r) => (
              <Card key={r.id} className="mb-2">
                <Text className="font-semibold text-white">{r.title}</Text>
                <Text className="mt-1 text-sm text-white/70">{r.body}</Text>
              </Card>
            ))
          ) : (
            <Text className="text-sm text-white/50">No detailed rules rows.</Text>
          )}
          <View className="mt-4 gap-2">
            <AppButton title="Join tournament" loading={join.isPending} onPress={onJoin} />
            <AppButton
              title="View bracket"
              variant="secondary"
              onPress={() => router.push(`/(app)/(tabs)/tournaments/${t.id}/bracket`)}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View className="mb-2">
      <Text className="text-xs uppercase text-white/40">{k}</Text>
      <Text className="text-sm text-white">{v}</Text>
    </View>
  );
}
