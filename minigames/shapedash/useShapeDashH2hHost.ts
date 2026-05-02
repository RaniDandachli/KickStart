import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform, useWindowDimensions } from 'react-native';

import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { SHAPE_DASH_INLINE_HTML } from '@/minigames/shapedash/shapeDashInlineHtml.generated';
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
  const fsHook = `
    (function(){
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      var once = false;
      function tryFs() {
        if (once) return;
        once = true;
        try {
          var de = document.documentElement;
          if (!document.fullscreenElement && de && de.requestFullscreen) { void de.requestFullscreen(); }
          if (screen && screen.orientation && screen.orientation.lock) { void screen.orientation.lock('landscape'); }
        } catch (_) {}
      }
      window.addEventListener('pointerdown', tryFs, { once: true, passive: true });
      window.addEventListener('keydown', tryFs, { once: true });
    })();
  `;
  const script = opts.marathon
    ? `<script>globalThis.__SHAPE_DASH_H2H=${opts.h2h ? '1' : '0'};globalThis.__SHAPE_DASH_BOOT=${boot};${fsHook}</script>`
    : `<script>globalThis.__SHAPE_DASH_H2H=${opts.h2h ? '1' : '0'};${fsHook}</script>`;
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

  const [phase, setPhase] = useState<Phase>('playing');
  const [wasSubmitted, setWasSubmitted] = useState(false);
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

  const requestWebFullscreenLandscape = useCallback(() => {
    if (Platform.OS !== 'web') return;
    try {
      const iframe = iframeRef.current;
      if (!iframe) return;
      if (!document.fullscreenElement && iframe.requestFullscreen) {
        void iframe.requestFullscreen().catch(() => {});
      }
      // @ts-expect-error web runtime only
      if (screen?.orientation?.lock) void screen.orientation.lock('landscape').catch(() => {});
    } catch (_) {
      /** ignore */
    }
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
