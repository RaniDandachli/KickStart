import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform, useWindowDimensions } from 'react-native';

import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { fetchH2hTapDashScoresForMatch } from '@/services/api/h2hTapDash';
import { SHAPE_DASH_INLINE_HTML } from '@/minigames/shapedash/shapeDashInlineHtml.generated';
import {
  enterWebAppFullscreen,
  tryLockWebLandscape,
} from '@/minigames/shapedash/webGameFullscreen';
import type { H2hSkillContestBundle } from '@/types/match';

export type Phase = 'playing' | 'results';

/** Injects Marathon boot (+ optional skip + H2H flag) before bundled game script. */
export function buildShapeDashHtml(opts: {
  marathon: boolean;
  skipAutoMarathon?: boolean;
  h2h: boolean;
}): string {
  const boot = opts.marathon
    ? JSON.stringify({
        defaultMode: 'marathon',
        skipAutoPlay: Boolean(opts.skipAutoMarathon),
      })
    : '';
  const script = opts.marathon
    ? `<script>globalThis.__SHAPE_DASH_H2H=${opts.h2h ? '1' : '0'};globalThis.__SHAPE_DASH_BOOT=${boot};</script>`
    : `<script>globalThis.__SHAPE_DASH_H2H=${opts.h2h ? '1' : '0'};</script>`;
  return SHAPE_DASH_INLINE_HTML.replace('<body>', `<body>${script}`);
}

export type ShapeDashDeathPayload = {
  kind: string;
  score: number;
  duration_ms: number;
  taps: number;
};

export function useShapeDashH2hHost(h2hSkillContest: H2hSkillContestBundle) {
  const { width, height } = useWindowDimensions();
  const minEmbedHeight = Math.max(280, Math.floor(height * 0.55));
  const webPortrait = Platform.OS === 'web' && height > width;

  const [phase, setPhase] = useState<Phase>(() => (h2hSkillContest.asyncHostSkipSubmit ? 'results' : 'playing'));
  const [wasSubmitted, setWasSubmitted] = useState(false);
  const [, setAsyncSeedTick] = useState(0);
  const html = useMemo(
    () =>
      buildShapeDashHtml({
        marathon: true,
        skipAutoMarathon: wasSubmitted,
        h2h: true,
      }),
    [wasSubmitted],
  );

  const lastRunRef = useRef({ score: 0, durationMs: 0, taps: 0 });
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const buildH2hBody = useCallback(() => {
    const r = lastRunRef.current;
    return {
      game_type: 'shape_dash' as const,
      score: r.score,
      duration_ms: r.durationMs,
      taps: r.taps,
      match_session_id: h2hSkillContest.matchSessionId,
    };
  }, [h2hSkillContest.matchSessionId]);

  useLayoutEffect(() => {
    if (!h2hSkillContest.asyncHostSkipSubmit) return;
    let cancelled = false;
    void fetchH2hTapDashScoresForMatch(h2hSkillContest.matchSessionId).then((data) => {
      if (cancelled || data?.self_score == null) return;
      lastRunRef.current = {
        score: data.self_score,
        durationMs: lastRunRef.current.durationMs,
        taps: lastRunRef.current.taps,
      };
      setAsyncSeedTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [h2hSkillContest.asyncHostSkipSubmit, h2hSkillContest.matchSessionId]);

  const focusIframeGame = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) return;
      iframe.focus();
      iframe.contentWindow?.focus();
    } catch (_) {
      /** ignore */
    }
  }, []);

  const { h2hSubmitPhase, h2hPoll, setH2hRetryKey } = useH2hSkillContestSubmitAndPoll(
    h2hSkillContest,
    phase,
    buildH2hBody,
    'results',
    { skipSubmit: Boolean(h2hSkillContest.asyncHostSkipSubmit) },
  );
  const submittedScore = lastRunRef.current.score;
  const showResultsOverlay = phase === 'results';

  useLayoutEffect(() => {
    if (Platform.OS === 'web') return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, []),
  );

  const requestWebFullscreenLandscape = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    const rootOk = await enterWebAppFullscreen();
    if (!rootOk) {
      const iframe = iframeRef.current;
      if (iframe && typeof iframe.requestFullscreen === 'function') {
        void iframe.requestFullscreen().catch(() => {});
      }
    }
    void tryLockWebLandscape();
  }, []);

  const handleMessageBody = useCallback(
    (raw: string | object) => {
      let obj: ShapeDashDeathPayload | null = null;
      if (typeof raw === 'string') {
        try {
          obj = JSON.parse(raw) as ShapeDashDeathPayload;
        } catch {
          return;
        }
      } else if (raw && typeof raw === 'object' && raw !== null && 'kind' in raw) {
        obj = raw as ShapeDashDeathPayload;
      }
      if (!obj || obj.kind !== 'shape_dash_h2h_death') return;
      if (phase === 'results') return;
      lastRunRef.current = {
        score: Math.max(0, Math.floor(Number(obj.score) || 0)),
        durationMs: Math.max(0, Math.floor(Number(obj.duration_ms) || 0)),
        taps: Math.max(0, Math.floor(Number(obj.taps) || 0)),
      };
      setWasSubmitted(true);
      setPhase('results');
    },
    [phase],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (ev: MessageEvent) => {
      const d = ev.data;
      if (d && typeof d === 'object' && (d as { kind?: string }).kind === 'shape_dash_h2h_death') {
        handleMessageBody(d);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleMessageBody]);

  return {
    html,
    phase,
    minEmbedHeight,
    webPortrait,
    width,
    height,
    showResultsOverlay,
    submittedScore,
    h2hSubmitPhase,
    h2hPoll,
    setH2hRetryKey,
    iframeRef,
    focusIframeGame,
    requestWebFullscreenLandscape,
    handleMessageBody,
    lastRunRef,
    opponentDisplayName: h2hSkillContest.opponentDisplayName,
  };
}
