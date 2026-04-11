import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Poll interval when backend is on (backup when `EXPO_PUBLIC_ENABLE_REALTIME` is off or flaky).
 * Realtime (`useRealtimeScaffold`) still preferred for instant invalidation.
 */
const POLL_MS = 45_000;

/**
 * Invalidates common Supabase-driven queries so active screens refetch fresh data.
 * Does not touch per-match keys (`matchSession`, etc.) — those stay on Realtime or screen focus.
 */
export function invalidateSharedSupabaseQueries(
  qc: ReturnType<typeof useQueryClient>,
  userId: string,
): void {
  void qc.invalidateQueries({ queryKey: ['tournaments'] });
  void qc.invalidateQueries({ queryKey: queryKeys.homeLobby() });
  void qc.invalidateQueries({ queryKey: ['seasonActive'] });
  void qc.invalidateQueries({ queryKey: ['leaderboard'] });
  void qc.invalidateQueries({ queryKey: ['prizeCatalog'] });
  void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
  void qc.invalidateQueries({ queryKey: queryKeys.userStats(userId) });
  void qc.invalidateQueries({ queryKey: queryKeys.recentMatches(userId) });
  void qc.invalidateQueries({ queryKey: queryKeys.ratings(userId) });
  void qc.invalidateQueries({ queryKey: queryKeys.transactions(userId) });
}

/**
 * Keeps lobby/profile/tournaments/etc. in sync: periodic refresh + refresh when app returns to foreground.
 */
export function useSupabaseCacheSync(userId: string | undefined): void {
  const qc = useQueryClient();
  const uidRef = useRef(userId);
  uidRef.current = userId;

  const invalidate = useCallback(() => {
    const uid = uidRef.current;
    if (!ENABLE_BACKEND || !uid) return;
    invalidateSharedSupabaseQueries(qc, uid);
  }, [qc]);

  useEffect(() => {
    if (!ENABLE_BACKEND || !userId) return;

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') invalidate();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [invalidate, userId]);

  useEffect(() => {
    if (!ENABLE_BACKEND || !userId) return;
    const id = setInterval(() => {
      invalidate();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [invalidate, userId]);
}
