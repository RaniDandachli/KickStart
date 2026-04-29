import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/functions-js';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { finalizeH2hTapDashScores } from '@/lib/h2hMinigameOutcome';
import { queryKeys } from '@/lib/queryKeys';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';
import { fetchH2hTapDashScoresForMatch } from '@/services/api/h2hTapDash';
import { getSupabase } from '@/supabase/client';
import type { H2hSkillContestBundle } from '@/types/match';

type H2hSubmitPhase = 'idle' | 'loading' | 'ok' | 'error';

/**
 * Submits a validated minigame score for an H2H match, then polls until both players are on record.
 * Reuse for any skill minigame that posts to `submitMinigameScore` with `match_session_id`.
 *
 * @param gamePhase current UI phase; when it equals `overPhase`, submits once (e.g. `'over'`, or `'results'` for Dash Duel).
 */
export function useH2hSkillContestSubmitAndPoll(
  h2hSkillContest: H2hSkillContestBundle | undefined,
  gamePhase: string,
  buildBody: () => Record<string, unknown>,
  overPhase: string = 'over',
  opts?: { skipSubmit?: boolean },
) {
  const isAlreadySubmittedConflict = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) return false;
    if (error.context.status !== 409) return false;
    try {
      const body = (await error.context.clone().json()) as { error?: string };
      const msg = String(body?.error ?? '').toLowerCase();
      return msg.includes('already submitted');
    } catch {
      return false;
    }
  };

  const [h2hSubmitPhase, setH2hSubmitPhase] = useState<H2hSubmitPhase>('idle');
  const [h2hRetryKey, setH2hRetryKey] = useState(0);
  const h2hSubmitInFlight = useRef(false);
  /** Avoids re-running the submit effect when `setH2hSubmitPhase('loading')` fires (that used to abort in-flight requests and double-POST the Edge function). */
  const h2hSubmitSuccessRef = useRef(false);
  const h2hDoneRef = useRef(false);
  const slowOpponentWarnedRef = useRef(false);
  const buildBodyRef = useRef(buildBody);
  buildBodyRef.current = buildBody;

  const shouldRunSubmitEffect = gamePhase === overPhase;

  const h2hSid = h2hSkillContest?.matchSessionId ?? '';
  const { data: h2hPoll } = useQuery({
    queryKey: queryKeys.h2hTapDashScores(h2hSid),
    queryFn: () => fetchH2hTapDashScoresForMatch(h2hSid),
    enabled: Boolean(h2hSkillContest) && h2hSubmitPhase === 'ok' && h2hSid.length > 0,
    refetchInterval: (q) => (q.state.data?.both_submitted ? false : 2000),
  });

  useEffect(() => {
    if (!h2hSkillContest) return;
    setH2hSubmitPhase('idle');
    h2hDoneRef.current = false;
    h2hSubmitInFlight.current = false;
    h2hSubmitSuccessRef.current = false;
    slowOpponentWarnedRef.current = false;
    setH2hRetryKey(0);
  }, [h2hSkillContest?.matchSessionId]);

  useEffect(() => {
    h2hSubmitSuccessRef.current = false;
  }, [h2hRetryKey]);

  useEffect(() => {
    if (!h2hSkillContest) return;
    // Dash Duel uses `home` instead of `ready`; other skill games use `ready`.
    if (gamePhase === 'ready' || gamePhase === 'home') {
      setH2hSubmitPhase('idle');
      h2hDoneRef.current = false;
      h2hSubmitInFlight.current = false;
      h2hSubmitSuccessRef.current = false;
      slowOpponentWarnedRef.current = false;
    }
  }, [gamePhase, h2hSkillContest]);

  useEffect(() => {
    if (h2hSubmitPhase !== 'ok' || h2hPoll?.both_submitted) {
      slowOpponentWarnedRef.current = false;
      return;
    }
    const id = setTimeout(() => {
      if (slowOpponentWarnedRef.current) return;
      slowOpponentWarnedRef.current = true;
      Alert.alert(
        'Waiting on your opponent',
        'They still need to finish and submit their run. If you leave the match now, it counts as a forfeit and they win. You can also file a dispute from the match screen if something looks wrong.',
        [{ text: 'OK' }],
      );
    }, 120_000);
    return () => clearTimeout(id);
  }, [h2hSubmitPhase, h2hPoll?.both_submitted, h2hSkillContest?.matchSessionId]);

  useEffect(() => {
    if (!h2hSkillContest || h2hSubmitPhase !== 'ok' || h2hDoneRef.current) return;
    if (!h2hPoll?.both_submitted || h2hPoll.self_score == null || h2hPoll.opponent_score == null) return;
    h2hDoneRef.current = true;
    h2hSkillContest.onComplete(
      finalizeH2hTapDashScores(
        h2hPoll.self_score,
        h2hPoll.opponent_score,
        h2hSkillContest.localPlayerId,
        h2hSkillContest.opponentId,
      ),
    );
  }, [h2hSkillContest, h2hSubmitPhase, h2hPoll]);

  useEffect(() => {
    if (!shouldRunSubmitEffect || !h2hSkillContest) {
      return;
    }
    if (opts?.skipSubmit) {
      h2hSubmitSuccessRef.current = true;
      h2hSubmitInFlight.current = false;
      setH2hSubmitPhase('ok');
      return;
    }
    if (h2hSubmitSuccessRef.current) return;
    if (h2hSubmitInFlight.current) return;

    h2hSubmitInFlight.current = true;
    setH2hSubmitPhase('loading');

    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          if (!cancelled) {
            Alert.alert('Sign in required', 'Log in to submit your score.');
            setH2hSubmitPhase('error');
          }
          return;
        }
        const { error } = await invokeEdgeFunction('submitMinigameScore', {
          body: buildBodyRef.current(),
        });
        if (cancelled) return;
        if (error) {
          if (await isAlreadySubmittedConflict(error)) {
            if (!cancelled) {
              h2hSubmitSuccessRef.current = true;
              setH2hSubmitPhase('ok');
            }
            return;
          }
          Alert.alert('Submit failed', error.message ?? 'Could not reach server.');
          if (!cancelled) setH2hSubmitPhase('error');
          return;
        }
        if (!cancelled) {
          h2hSubmitSuccessRef.current = true;
          setH2hSubmitPhase('ok');
        }
      } catch {
        if (!cancelled) setH2hSubmitPhase('error');
      } finally {
        h2hSubmitInFlight.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldRunSubmitEffect, h2hSkillContest, h2hRetryKey, opts?.skipSubmit]);

  return {
    h2hSubmitPhase,
    h2hPoll,
    h2hRetryKey,
    setH2hRetryKey,
  };
}
