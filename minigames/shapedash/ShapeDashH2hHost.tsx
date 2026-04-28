import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import WebView from 'react-native-webview';

import { AppButton } from '@/components/ui/AppButton';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { Countdown } from '@/minigames/ui/Countdown';
import { SHAPE_DASH_INLINE_HTML } from '@/minigames/shapedash/shapeDashInlineHtml.generated';
import type { H2hSkillContestBundle } from '@/types/match';

type Phase = 'countdown' | 'playing' | 'results';

/** Injects Marathon boot (+ optional skip + H2H flag) before bundled game script. */
function buildShapeDashHtml(opts: {
  marathon: boolean;
  skipAutoMarathon?: boolean;
  h2h: boolean;
}): string {
  const parts = ['<script>'];
  if (opts.h2h) {
    parts.push('globalThis.__SHAPE_DASH_H2H=1;');
  }
  if (opts.marathon) {
    parts.push(
      `globalThis.__SHAPE_DASH_BOOT=${JSON.stringify({
        defaultMode: 'marathon',
        skipAutoPlay: Boolean(opts.skipAutoMarathon),
      })};`,
    );
  }
  parts.push('<\\/script>');
  return SHAPE_DASH_INLINE_HTML.replace('<body>', `<body>${parts.join('')}`);
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
  const { height: windowHeight } = useWindowDimensions();
  /** Head-to-head match stack sometimes gives RN WebView 0 height until a floor is set */
  const minEmbedHeight = Math.max(280, Math.floor(windowHeight * 0.55));

  const [phase, setPhase] = useState<Phase>('countdown');
  const html = useMemo(
    () =>
      buildShapeDashHtml({
        marathon: true,
        skipAutoMarathon: true,
        h2h: true,
      }),
    [],
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

  const { h2hSubmitPhase, h2hPoll, setH2hRetryKey } = useH2hSkillContestSubmitAndPoll(
    h2hSkillContest,
    phase,
    buildH2hBody,
    'results',
  );

  const kickStartMarathon = useCallback(() => {
    const js =
      '(function(){try{if(typeof window.startMarathon==="function")window.startMarathon();}catch(e){}})();true;';
    if (Platform.OS === 'web') {
      try {
        iframeRef.current?.contentWindow?.postMessage({ type: 'shape-dash-start-marathon' }, '*');
      } catch (_) {
        /** ignore */
      }
      return;
    }
    webRef.current?.injectJavaScript(js);
  }, []);

  const onCountdownDone = useCallback(() => {
    setPhase('playing');
    kickStartMarathon();
  }, [kickStartMarathon]);

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
      setPhase('results');
    },
    [phase],
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

  const kickResizeInFrame = useCallback(() => {
    try {
      const w = iframeRef.current?.contentWindow;
      if (w) w.dispatchEvent(new Event('resize'));
    } catch (_) {
      /** ignore */
    }
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.flex, { minHeight: minEmbedHeight }]}>
        <View style={[styles.flex, { position: 'relative', minHeight: minEmbedHeight }]}>
          {createElement('iframe', {
            title: 'Shape Dash H2H',
            srcDoc: html,
            allow: 'fullscreen',
            onLoad: (ev: unknown) => {
              const iframe = (ev as { target?: HTMLIFrameElement })?.target;
              if (iframe) iframeRef.current = iframe;
              kickResizeInFrame();
              setTimeout(kickResizeInFrame, 50);
              setTimeout(kickResizeInFrame, 200);
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
            ref: (el: HTMLIFrameElement | null) => {
              iframeRef.current = el;
            },
          })}
        </View>

        {phase === 'countdown' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,23,42,0.75)', zIndex: 40 }]} pointerEvents="auto">
            <Countdown active onComplete={onCountdownDone} />
          </View>
        ) : null}

        {phase === 'results' ? (
          <View style={[styles.h2hBanner, { zIndex: 50 }]} pointerEvents="box-none">
            <Text style={styles.bannerTitle}>Run recorded</Text>
            <Text style={styles.bannerSub}>
              Head-to-head: higher marathon distance wins after both runs submit ({h2hSkillContest.opponentDisplayName} vs
              you).
            </Text>
            {h2hSubmitPhase === 'loading' ? (
              <Text style={styles.bannerMeta}>Submitting your run…</Text>
            ) : null}
            {h2hSubmitPhase === 'error' ? (
              <AppButton title="Retry submit" variant="secondary" className="mt-2" onPress={() => setH2hRetryKey((k) => k + 1)} />
            ) : null}
            {h2hSubmitPhase === 'ok' && !h2hPoll?.both_submitted ? (
              <Text style={styles.bannerMeta}>Waiting for {h2hSkillContest.opponentDisplayName}…</Text>
            ) : null}
            {h2hSubmitPhase === 'ok' && h2hPoll?.both_submitted ? (
              <Text style={styles.bannerMeta}>Both runs in — finalizing…</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { minHeight: minEmbedHeight }]}>
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

      {phase === 'countdown' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,23,42,0.75)', zIndex: 40 }]} pointerEvents="auto">
          <Countdown active onComplete={onCountdownDone} />
        </View>
      ) : null}

      {phase === 'results' ? (
        <View style={[styles.h2hBanner, { zIndex: 50 }]} pointerEvents="box-none">
          <Text style={styles.bannerTitle}>Run recorded</Text>
          <Text style={styles.bannerSub}>
            Head-to-head: higher marathon distance wins after both runs submit ({h2hSkillContest.opponentDisplayName} vs
            you).
          </Text>
          {h2hSubmitPhase === 'loading' ? <Text style={styles.bannerMeta}>Submitting your run…</Text> : null}
          {h2hSubmitPhase === 'error' ? (
            <AppButton title="Retry submit" variant="secondary" className="mt-2" onPress={() => setH2hRetryKey((k) => k + 1)} />
          ) : null}
          {h2hSubmitPhase === 'ok' && !h2hPoll?.both_submitted ? (
            <Text style={styles.bannerMeta}>Waiting for {h2hSkillContest.opponentDisplayName}…</Text>
          ) : null}
          {h2hSubmitPhase === 'ok' && h2hPoll?.both_submitted ? (
            <Text style={styles.bannerMeta}>Both runs in — finalizing…</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#060610', minHeight: 0 },
  h2hBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    paddingBottom: 20,
    backgroundColor: 'rgba(6, 6, 16, 0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.35)',
  },
  bannerTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  bannerSub: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginTop: 8, textAlign: 'center' },
  bannerMeta: { color: 'rgba(148,163,184,0.95)', fontSize: 13, marginTop: 10, textAlign: 'center' },
});
