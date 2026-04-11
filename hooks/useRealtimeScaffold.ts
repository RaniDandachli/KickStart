import { useEffect } from 'react';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import { getSupabase } from '@/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * When `EXPO_PUBLIC_ENABLE_REALTIME=true` and tables are in `supabase_realtime`, invalidates
 * lobby/profile caches on relevant rows. Enable replication in Supabase for the tables you use.
 */
export function useRealtimeScaffold(userId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!ENABLE_BACKEND || !env.EXPO_PUBLIC_ENABLE_REALTIME || !userId) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel('kickclash-scaffold')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => {
        void qc.invalidateQueries({ queryKey: ['tournaments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_sessions' }, () => {
        void qc.invalidateQueries({ queryKey: ['profile'] });
        void qc.invalidateQueries({ queryKey: queryKeys.homeLobby() });
        void qc.invalidateQueries({ queryKey: ['userStats'] });
        void qc.invalidateQueries({ queryKey: ['recentMatches'] });
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_stats',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['userStats'] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'minigame_scores',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
          void qc.invalidateQueries({ queryKey: queryKeys.homeLobby() });
        },
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => {
        void qc.invalidateQueries({ queryKey: queryKeys.homeLobby() });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard_snapshots' }, () => {
        void qc.invalidateQueries({ queryKey: ['leaderboard'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        if (userId) void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, userId]);
}
