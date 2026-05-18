import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateAsyncBattleBoardQueries } from '@/services/api/h2hAsyncHostOpenChallenges';
import type { AsyncH2hQueueSubmit } from '@/types/match';

export type AsyncH2hQueueSubmitPhase = 'idle' | 'loading' | 'ok' | 'error';

/**
 * After a solo/practice run ends, charge wallet + enqueue async host row for this game + tier.
 */
export function useAsyncH2hQueueHostSubmission(opts: {
  /** e.g. phase === 'over' or phase === 'results' (Dash Duel) */
  shouldSubmit: boolean;
  asyncH2hQueueSubmit: AsyncH2hQueueSubmit | undefined;
  /** When true, skip (e.g. H2H match flow, daily event, solo challenge). */
  blocked: boolean;
  getStats: () => { score: number; durationMs: number; taps: number };
  uid: string | undefined;
}) {
  const queryClient = useQueryClient();
  const doneRef = useRef(false);
  const [phase, setPhase] = useState<AsyncH2hQueueSubmitPhase>('idle');
  const getStatsRef = useRef(opts.getStats);
  getStatsRef.current = opts.getStats;

  const resetAsyncSubmission = useCallback(() => {
    doneRef.current = false;
    setPhase('idle');
  }, []);

  useEffect(() => {
    if (!opts.shouldSubmit || !opts.asyncH2hQueueSubmit || opts.blocked) return;
    if (!ENABLE_BACKEND || !opts.uid) return;
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('loading');
    const { score, durationMs, taps } = getStatsRef.current();
    void submitAsyncH2hHostSkillRun({
      mode: opts.asyncH2hQueueSubmit.mode,
      gameKey: opts.asyncH2hQueueSubmit.gameKey,
      entryFeeWalletCents: opts.asyncH2hQueueSubmit.entryFeeWalletCents,
      listedPrizeUsdCents: opts.asyncH2hQueueSubmit.listedPrizeUsdCents,
      score,
      durationMs,
      taps,
    }).then((r) => {
      if (r.ok) {
        setPhase('ok');
        invalidateProfileEconomy(queryClient, opts.uid!);
        void queryClient.invalidateQueries({ queryKey: queryKeys.myAsyncHostPending(opts.uid!) });
        invalidateAsyncBattleBoardQueries(queryClient);
        Alert.alert(
          'Contest locked in',
          'Your wallet entry is held and this run is on record for this tier. Someone who later joins the same stake row still plays live; we compare scores when they finish. You can leave and use Home or notifications when you get a hit.',
        );
      } else {
        setPhase('error');
        doneRef.current = false;
        Alert.alert('Could not lock contest', r.error);
      }
    });
  }, [opts.shouldSubmit, opts.asyncH2hQueueSubmit, opts.blocked, opts.uid, queryClient]);

  return { asyncHostSubmitPhase: phase, resetAsyncSubmission };
}
