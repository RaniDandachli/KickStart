import { createElement, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type Props = { html: string };

/**
 * Web: DOM iframe + srcDoc (react-native-webview is not loaded on this platform).
 */
export function ShapeDashGameEmbed({ html }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const injected = useMemo(
    () => `
      (function() {
        document.documentElement.style.background = '#060610';
        document.body.style.background = '#060610';
      })();
      true;
    `,
    [],
  );

  const requestWebFullscreenLandscape = () => {
    if (Platform.OS !== 'web') return;
    try {
      const iframe = iframeRef.current;
      if (!iframe) return;
      if (!document.fullscreenElement && iframe.requestFullscreen) {
        void iframe.requestFullscreen().catch(() => {});
      }
      // @ts-expect-error web runtime only
      if (screen?.orientation?.lock) void screen.orientation.lock('landscape').catch(() => {});
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.embedWrap} accessibilityLabel="Shape Dash">
      {createElement('iframe', {
        srcDoc: html,
        title: 'Shape Dash',
        onLoad: () => {
          requestWebFullscreenLandscape();
          setTimeout(requestWebFullscreenLandscape, 120);
        },
        style: ({
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
          backgroundColor: '#060610',
          flexGrow: 1,
        }) as Record<string, unknown>,
        allow: 'fullscreen',
        tabIndex: 0,
        ref: (el: HTMLIFrameElement | null) => {
          iframeRef.current = el;
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  embedWrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#060610',
  },
});
