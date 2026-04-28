/**
 * Hosted HTML5 canvas Geometry-Dash tribute.
 * - Native: WebView with bundled HTML.
 * - Web: iframe + srcDoc (react-native-webview does not support web).
 *
 * Boot mode (search param `mode`):
 * - `mode=marathon` — auto-starts endless Marathon (competitive / money matchups).
 * - Omit or anything else — main menu so the player can pick Marathon vs Classic Levels (arcade / practice).
 */
import { createElement, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useMinigameExitNav } from '@/minigames/ui/useMinigameExitNav';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { runitFont } from '@/lib/runitArcadeTheme';

import { SHAPE_DASH_INLINE_HTML } from '@/minigames/shapedash/shapeDashInlineHtml.generated';

function injectShapeDashBoot(html: string, defaultMode: 'menu' | 'marathon'): string {
  if (defaultMode !== 'marathon') return html;
  const payload = JSON.stringify({ defaultMode: 'marathon' });
  /* Boot runs before bundled game script so Marathon can auto-start when competing. */
  return html.replace('<body>', `<body><script>globalThis.__SHAPE_DASH_BOOT=${payload};</script>`);
}

function ShapeDashGameEmbed({ html }: { html: string }) {
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

  if (Platform.OS === 'web') {
    /** RN Web has no native WebView; iframe + srcDoc runs the same document. */
    return (
      <View style={styles.embedWrap} accessibilityLabel="Shape Dash">
        {/* DOM iframe — only built on web bundle */}
        {createElement('iframe', {
          srcDoc: html,
          title: 'Shape Dash',
          style: ({
            border: 'none',
            width: '100%',
            height: '100%',
            display: 'block',
            backgroundColor: '#060610',
            flexGrow: 1,
          }) as Record<string, unknown>,
          allow: 'fullscreen',
        })}
      </View>
    );
  }

  return (
    <WebView
      style={styles.web}
      originWhitelist={['*']}
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      injectedJavaScriptBeforeContentLoaded={injected}
      nestedScrollEnabled
      allowsFullscreenVideo={false}
      mediaPlaybackRequiresUserAction
      {...(Platform.OS === 'android' ? { mixedContentMode: 'always' as const } : {})}
      {...(Platform.OS === 'ios' ? { allowsInlineMediaPlayback: true as const } : {})}
      setBuiltInZoomControls={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      bounces={false}
      scrollEnabled={false}
    />
  );
}

export default function ShapeDashScreen() {
  useHidePlayTabBar();
  const { onHeaderBackPress, replacePrimaryLabel } = useMinigameExitNav();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();

  const bootMode =
    typeof params.mode === 'string'
      ? params.mode
      : Array.isArray(params.mode)
        ? params.mode[0]
        : undefined;

  const html = useMemo(
    () =>
      injectShapeDashBoot(SHAPE_DASH_INLINE_HTML, bootMode === 'marathon' ? 'marathon' : 'menu'),
    [bootMode],
  );

  return (
    <View style={styles.wrap}>
      <SafeAreaView style={styles.safeTop} edges={['top']} accessibilityRole="header">
        <Pressable
          onPress={onHeaderBackPress}
          accessibilityRole="button"
          accessibilityLabel={`Back · ${replacePrimaryLabel}`}
          hitSlop={12}
          style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.88 }]}
        >
          <SafeIonicons name="chevron-back" size={24} color="#22d3ee" />
          <Text style={styles.backTxt}>{replacePrimaryLabel}</Text>
        </Pressable>
      </SafeAreaView>
      <ShapeDashGameEmbed html={html} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#060610',
  },
  safeTop: {
    backgroundColor: 'rgba(6, 6, 16, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.25)',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
  },
  backTxt: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: runitFont.black,
  },
  embedWrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#060610',
  },
  web: {
    flex: 1,
    backgroundColor: '#060610',
  },
});

