import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { useActiveSeason } from '@/hooks/useActiveSeason';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { mockLeaderboardFallback } from '@/lib/mockHome';
import { useProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/store/authStore';

export default function LeaderboardScreen() {
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const seasonQ = useActiveSeason();
  const [scope, setScope] = useState<'global' | 'regional' | 'friends'>('global');
  const [region, setRegion] = useState('global');

  const seasonId = seasonQ.data?.id ?? null;

  const lbQ = useLeaderboard({ seasonId, scope, region });

  const rows = useMemo(() => {
    if (lbQ.data && lbQ.data.length > 0) return lbQ.data;
    return mockLeaderboardFallback(seasonId);
  }, [lbQ.data, seasonId]);

  return (
    <Screen>
      <Text className="mb-4 text-3xl font-black text-white">Leaderboard</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        <FilterChip active={scope === 'global'} label="Global" onPress={() => setScope('global')} />
        <FilterChip active={scope === 'regional'} label="Seasonal" onPress={() => setScope('regional')} />
        <FilterChip active={scope === 'friends'} label="Friends (soon)" onPress={() => setScope('friends')} />
      </View>
      <View className="mb-4 flex-row flex-wrap gap-2">
        <FilterChip active={region === 'global'} label="All regions" onPress={() => setRegion('global')} />
        <FilterChip active={region === 'na'} label="NA" onPress={() => setRegion('na')} />
        <FilterChip active={region === 'eu'} label="EU" onPress={() => setRegion('eu')} />
      </View>
      {scope === 'friends' ? (
        <EmptyState
          title="Friends leaderboard"
          description="TODO: Graph from social graph / invites — placeholder only."
        />
      ) : lbQ.isLoading ? (
        <>
          <SkeletonBlock className="mb-2 h-16" />
          <SkeletonBlock className="mb-2 h-16" />
        </>
      ) : (
        rows.map((r) => (
          <Card key={r.id} className="mb-2 flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-white/50">Rank #{r.rank}</Text>
              <Text className="text-lg font-bold text-white">Player {r.user_id.slice(0, 6)}…</Text>
              <View className="mt-1 flex-row gap-2">
                <Badge label={`${r.wins} W`} tone="success" />
                <Badge label={`${Math.round((r.win_rate ?? 0) * 100)}% WR`} />
                <Badge
                  label={r.streak > 0 ? `+${r.streak} streak` : `${r.streak} streak`}
                  tone={r.streak > 0 ? 'neon' : 'default'}
                />
              </View>
            </View>
            <View className="items-end">
              <Text className="text-2xl font-black text-neon-lime">{r.rating}</Text>
              <Text
                className={`text-xs ${r.rank_delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}
              >
                {r.rank_delta >= 0 ? '▲' : '▼'} {Math.abs(r.rank_delta)} ranks
              </Text>
            </View>
          </Card>
        ))
      )}
      <Card className="mt-4">
        <Text className="text-xs uppercase text-white/50">You</Text>
        <Text className="text-base text-white">
          {profileQ.data?.username ?? 'Sign in to track rank placement.'}
        </Text>
      </Card>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        active ? 'border-neon-lime bg-neon-lime/20 text-neon-lime' : 'border-white/20 text-white/70'
      }`}
    >
      {label}
    </Text>
  );
}
