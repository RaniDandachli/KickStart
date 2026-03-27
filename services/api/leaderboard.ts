import type { LeaderboardSnapshotRow } from '@/types/database';
import { getSupabase } from '@/supabase/client';

export async function fetchLeaderboard(params: {
  seasonId: string | null;
  scope: 'global' | 'regional' | 'friends';
  region: string;
  limit?: number;
}): Promise<LeaderboardSnapshotRow[]> {
  const supabase = getSupabase();
  let q = supabase
    .from('leaderboard_snapshots')
    .select('*')
    .eq('scope', params.scope)
    .eq('region', params.region)
    .order('rank', { ascending: true })
    .limit(params.limit ?? 50);

  if (params.seasonId) q = q.eq('season_id', params.seasonId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as LeaderboardSnapshotRow[];
}
