import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import WebView from 'react-native-webview';

import { AppButton } from '@/components/ui/AppButton';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { SHAPE_DASH_INLINE_HTML } from '@/minigames/shapedash/shapeDashInlineHtml.generated';
import { GameOverExitRow } from '@/minigames/ui/GameOverExitRow';
import { useMinigameExitNav } from '@/minigames/ui/useMinigameExitNav';
import type { H2hSkillContestBundle } from '@/types/match';

type Phase = 'playing' | 'results';

/** Injects Marathon boot (+ optional skip + H2H flag) before bundled game script. */
function buildShapeDashHtml(opts: {
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

type ShapeDashDeathPayload = {
  kind: string;
  score: number;
  duration_ms: number;
  taps: number;
};

export function ShapeDashH2hHost({
  h2hSkillContest,
}: {
  h2hSkillContest: H2hSkillContestBundle;
}) {
  const { replaceToPrimaryExit, replacePrimaryLabel, replaceToHomeTab } = useMinigameExitNav();
  const { height: windowHeight } = useWindowDimensions();
  const { width, height } = useWindowDimensions();
  /** Head-to-head match stack sometimes gives RN WebView 0 height until a floor is set */
  const minEmbedHeight = Math.max(280, Math.floor(windowHeight * 0.55));
  const webPortrait = Platform.OS === 'web' && height > width;

  const [phase, setPhase] = useState<Phase>('playing');
  const [wasSubmitted, setWasSubmitted] = useState(false);
  const submittedKey = `shape_dash_h2h_submitted_${h2hSkillContest.matchSessionId}`;
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
  const webRef = useRef<WebView>(null);
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
    { skipSubmit: wasSubmitted },
  );
  const submittedScore = lastRunRef.current.score;
  const showResultsOverlay = phase === 'results';

  // Keep live Shape Dash landscape on native (same behavior style as Dash Duel).
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(submittedKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { score?: number; durationMs?: number; taps?: number };
      lastRunRef.current = {
        score: Math.max(0, Math.floor(Number(parsed.score) || 0)),
        durationMs: Math.max(0, Math.floor(Number(parsed.durationMs) || 0)),
        taps: Math.max(0, Math.floor(Number(parsed.taps) || 0)),
      };
      setWasSubmitted(true);
      setPhase('results');
    } catch {
      // ignore bad cache
    }
  }, [submittedKey]);

  const requestWebFullscreenLandscape = useCallback(() => {
    if (Platform.OS !== 'web') return;
    try {
      const iframe = iframeRef.current;
      if (!iframe) return;
      if (!document.fullscreenElement && iframe.requestFullscreen) {
        void iframe.requestFullscreen().catch(() => {});
      }
      // Safari often ignores this unless fullscreen + user gesture; best effort.
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
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(submittedKey, JSON.stringify(lastRunRef.current));
        } catch {
          // ignore
        }
      }
      setWasSubmitted(true);
      setPhase('results');
    },
    [phase, submittedKey],
  );

  /** Web iframe: subscribe to messages from iframe */
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

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.flex, { minHeight: minEmbedHeight }]}>
        {!showResultsOverlay ? (
          <View style={[styles.flex, { position: 'relative', minHeight: minEmbedHeight }]}>
            {createElement('iframe', {
              title: 'Shape Dash H2H',
              srcDoc: html,
              allow: 'fullscreen',
              onLoad: (ev: unknown) => {
                const iframe = (ev as { target?: HTMLIFrameElement })?.target;
                if (iframe) iframeRef.current = iframe;
                focusIframeGame();
                requestWebFullscreenLandscape();
                setTimeout(focusIframeGame, 60);
                setTimeout(focusIframeGame, 220);
                setTimeout(requestWebFullscreenLandscape, 80);
              },
              style: ({
                border: 'none',
                width: '100%',
                height: '100%',
                minHeight: minEmbedHeight,
                display: 'block',
                backgroundColor: '#060610',
                flexGrow: 1,
              }) as Record<string, unknown>,
              tabIndex: 0,
              ref: (el: HTMLIFrameElement | null) => {
                iframeRef.current = el;
              },
            })}
          </View>
        ) : (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.card}>
              <GameOverExitRow
                minigamesLabel={replacePrimaryLabel}
                onMinigames={replaceToPrimaryExit}
                onHome={replaceToHomeTab}
              />
              <Text style={styles.goTitle}>Run ended</Text>
              <Text style={styles.goScore}>Your distance: {submittedScore}</Text>
              {h2hSubmitPhase === 'loading' ? <Text style={styles.practiceNote}>Submitting your run…</Text> : null}
              {h2hSubmitPhase === 'error' ? (
                <>
                  <Text style={styles.practiceNote}>Could not submit this run. Check your connection.</Text>
                  <AppButton title="Retry submit" variant="secondary" className="mt-2" onPress={() => setH2hRetryKey((k) => k + 1)} />
                </>
              ) : null}
              {h2hSubmitPhase === 'ok' && !h2hPoll?.both_submitted ? (
                <Text style={styles.practiceNote}>Waiting for {h2hSkillContest.opponentDisplayName} to finish…</Text>
              ) : null}
              {h2hSubmitPhase === 'ok' && h2hPoll?.both_submitted ? (
                <Text style={styles.practiceNote}>Both runs in — finalizing match…</Text>
              ) : null}
            </View>
          </View>
        )}
        {webPortrait && !showResultsOverlay ? (
          <View style={styles.rotateHint} pointerEvents="none">
            <Text style={styles.rotateHintText}>Rotate to landscape for live Shape Dash</Text>
          </View>
        ) : null}
        {Platform.OS === 'web' && !showResultsOverlay ? (
          <View style={styles.fullscreenTapZone} pointerEvents="box-none">
            <AppButton title="Fullscreen" variant="ghost" onPress={requestWebFullscreenLandscape} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { minHeight: minEmbedHeight }]}>
      {!showResultsOverlay ? (
        <WebView
          ref={webRef}
          style={[styles.flex, { minHeight: minEmbedHeight }]}
          originWhitelist={['*']}
          source={{ html }}
          javaScriptEnabled
          domStorageEnabled
          nestedScrollEnabled
          onLoadEnd={() => {
            webRef.current?.injectJavaScript(
              '(function(){try{window.dispatchEvent(new Event("resize"));}catch(e){}})();true;',
            );
            setTimeout(() => {
              webRef.current?.injectJavaScript(
                '(function(){try{window.dispatchEvent(new Event("resize"));}catch(e){}})();true;',
              );
            }, 150);
          }}
          onMessage={(m) => handleMessageBody(m.nativeEvent.data)}
          mediaPlaybackRequiresUserAction
          setBuiltInZoomControls={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
          scrollEnabled={false}
          {...(Platform.OS === 'android' ? { mixedContentMode: 'always' as const } : {})}
          {...(Platform.OS === 'ios' ? { allowsInlineMediaPlayback: true as const } : {})}
        />
      ) : null}
      {showResultsOverlay ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.card}>
            <GameOverExitRow
              minigamesLabel={replacePrimaryLabel}
              onMinigames={replaceToPrimaryExit}
              onHome={replaceToHomeTab}
            />
            <Text style={styles.goTitle}>Run ended</Text>
            <Text style={styles.goScore}>Your distance: {submittedScore}</Text>
            {h2hSubmitPhase === 'loading' ? <Text style={styles.practiceNote}>Submitting your run…</Text> : null}
            {h2hSubmitPhase === 'error' ? (
              <>
                <Text style={styles.practiceNote}>Could not submit this run. Check your connection.</Text>
                <AppButton title="Retry submit" variant="secondary" className="mt-2" onPress={() => setH2hRetryKey((k) => k + 1)} />
              </>
            ) : null}
            {h2hSubmitPhase === 'ok' && !h2hPoll?.both_submitted ? (
              <Text style={styles.practiceNote}>Waiting for {h2hSkillContest.opponentDisplayName} to finish…</Text>
            ) : null}
            {h2hSubmitPhase === 'ok' && h2hPoll?.both_submitted ? (
              <Text style={styles.practiceNote}>Both runs in — finalizing match…</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {webPortrait && !showResultsOverlay ? (
        <View style={styles.rotateHint} pointerEvents="none">
          <Text style={styles.rotateHintText}>Rotate to landscape for live Shape Dash</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#060610', minHeight: 0 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 50,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    backgroundColor: 'rgba(10, 15, 28, 0.98)',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  goTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  goScore: { color: 'rgba(148,163,184,0.95)', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  practiceNote: { marginTop: 8, color: 'rgba(148,163,184,0.95)', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  rotateHint: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 10,
    alignItems: 'center',
    zIndex: 60,
  },
  rotateHintText: {
    color: '#fde68a',
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: 'rgba(2,6,23,0.78)',
    borderColor: 'rgba(251,191,36,0.45)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fullscreenTapZone: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 70,
  },
});

