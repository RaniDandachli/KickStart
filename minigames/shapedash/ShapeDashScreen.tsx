/**
 * Hosted HTML5 canvas Geometry-Dash tribute.
 * - Native: WebView with bundled HTML.
 * - Web: iframe + srcDoc (react-native-webview does not support web).
 *
 * Boot mode (search param `mode`):
 * - `mode=marathon` — auto-starts endless Marathon (competitive / money matchups).
 * - Omit or anything else — main menu so the player can pick Marathon vs Classic Levels (arcade / practice).
 */
import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useMinigameExitNav } from '@/minigames/ui/useMinigameExitNav';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { runitFont } from '@/lib/runitArcadeTheme';

import { ShapeDashGameEmbed } from '@/minigames/shapedash/ShapeDashGameEmbed';
import { SHAPE_DASH_INLINE_HTML } from '@/minigames/shapedash/shapeDashInlineHtml.generated';

function injectShapeDashBoot(html: string, defaultMode: 'menu' | 'marathon'): string {
  const payload =
    defaultMode === 'marathon' ? JSON.stringify({ defaultMode: 'marathon' }) : '';
  const boot = defaultMode === 'marathon' ? `globalThis.__SHAPE_DASH_BOOT=${payload};` : '';
  const webFs = `
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
  return html.replace('<body>', `<body><script>${boot}${webFs}</script>`);
}

export default function ShapeDashScreen() {
  useHidePlayTabBar();
  const { onHeaderBackPress, replacePrimaryLabel } = useMinigameExitNav();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { width, height } = useWindowDimensions();
  const webPortrait = Platform.OS === 'web' && height > width;

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

  // Match Dash Duel behavior: keep Shape Dash in landscape on native devices.
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
      {webPortrait ? (
        <View style={styles.rotateHint} pointerEvents="none">
          <Text style={styles.rotateHintText}>Rotate to landscape for Shape Dash</Text>
        </View>
      ) : null}
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
  rotateHint: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 68,
    alignItems: 'center',
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
});

