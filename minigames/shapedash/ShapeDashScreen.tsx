/**
 * Hosted HTML5 canvas Geometry-Dash tribute.
 * - Native: WebView with bundled HTML.
 * - Web: iframe + srcDoc (react-native-webview does not support web).
 *
 * Boot mode (search param `mode`):
 * - `mode=marathon` — auto-starts endless Marathon (competitive / money matchups).
 * - Omit or anything else — main menu so the player can pick Marathon vs Classic Levels (arcade / practice).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useMinigameExitNav } from '@/minigames/ui/useMinigameExitNav';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { runitFont } from '@/lib/runitArcadeTheme';

import { ShapeDashGameEmbed } from '@/minigames/shapedash/ShapeDashGameEmbed';
import { SHAPE_DASH_INLINE_HTML } from '@/minigames/shapedash/shapeDashInlineHtml.generated';
import {
  enterWebAppFullscreen,
  exitWebAppFullscreen,
  getWebFullscreenElement,
  subscribeWebFullscreenChange,
  tryLockWebLandscape,
} from '@/minigames/shapedash/webGameFullscreen';

function injectShapeDashBoot(html: string, defaultMode: 'menu' | 'marathon'): string {
  const payload =
    defaultMode === 'marathon' ? JSON.stringify({ defaultMode: 'marathon' }) : '';
  const boot = defaultMode === 'marathon' ? `globalThis.__SHAPE_DASH_BOOT=${payload};` : '';
  return html.replace('<body>', `<body><script>${boot}</script>`);
}

export default function ShapeDashScreen() {
  useHidePlayTabBar();
  const { onHeaderBackPress, replacePrimaryLabel } = useMinigameExitNav();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { width, height } = useWindowDimensions();
  const webPortrait = Platform.OS === 'web' && height > width;
  const insets = useSafeAreaInsets();
  const [webImmersive, setWebImmersive] = useState(false);
  const [webBrowserFs, setWebBrowserFs] = useState(false);

  const iosSafariNotStandalone = useMemo(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || typeof window === 'undefined') {
      return false;
    }
    const ua = navigator.userAgent;
    const iOS = /iP(ad|hone|od)/i.test(ua);
    const webKit = /WebKit/i.test(ua);
    const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    if (!iOS || !webKit || !notOther) return false;
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const mq =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches;
    return !standalone && !mq;
  }, []);

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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return subscribeWebFullscreenChange(() => setWebBrowserFs(!!getWebFullscreenElement()));
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (Platform.OS !== 'web') return;
        setWebImmersive(false);
        void exitWebAppFullscreen();
      };
    }, []),
  );

  const enterWebGameFullscreen = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    setWebImmersive(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await enterWebAppFullscreen();
    void tryLockWebLandscape();
  }, []);

  const exitWebGameFullscreen = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    setWebImmersive(false);
    if (getWebFullscreenElement()) await exitWebAppFullscreen();
  }, []);

  const showWebTopChrome = Platform.OS === 'web' && !webImmersive && !webBrowserFs;
  const showWebExitFs = Platform.OS === 'web' && (webImmersive || webBrowserFs);

  return (
    <View style={[styles.wrap, Platform.OS === 'web' && webImmersive && !webBrowserFs && styles.wrapImmersiveWeb]}>
      {showWebTopChrome ? (
        <SafeAreaView style={styles.safeTop} edges={['top']} accessibilityRole="header">
          <View style={styles.chromeRow}>
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
            <Pressable
              onPress={enterWebGameFullscreen}
              accessibilityRole="button"
              accessibilityLabel="Fullscreen game"
              hitSlop={12}
              style={({ pressed }) => [styles.fsChip, pressed && { opacity: 0.88 }]}
            >
              <SafeIonicons name="open-outline" size={18} color="#a5f3fc" />
              <Text style={styles.fsChipTxt}>Fullscreen</Text>
            </Pressable>
          </View>
          {iosSafariNotStandalone ? (
            <Text style={styles.pwaTip}>
              Safari keeps chrome in a normal tab — Share → Add to Home Screen, then open from the icon for an
              app-like fullscreen shell.
            </Text>
          ) : null}
        </SafeAreaView>
      ) : null}
      {Platform.OS !== 'web' ? (
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
      ) : null}
      {showWebExitFs ? (
        <Pressable
          onPress={exitWebGameFullscreen}
          accessibilityRole="button"
          accessibilityLabel="Exit fullscreen"
          hitSlop={14}
          style={[
            styles.webExitFs,
            { top: Math.max(10, insets.top + 6), left: Math.max(10, insets.left + 4) },
          ]}
        >
          <SafeIonicons name="chevron-back" size={22} color="#22d3ee" />
          <Text style={styles.webExitFsTxt}>Exit</Text>
        </Pressable>
      ) : null}
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
  wrapImmersiveWeb: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100dvh',
    zIndex: 99998,
    maxHeight: '100dvh',
  },
  safeTop: {
    backgroundColor: 'rgba(6, 6, 16, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.25)',
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 8,
    minHeight: 44,
    flexShrink: 1,
  },
  fsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  fsChipTxt: {
    color: '#e0f2fe',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: runitFont.black,
  },
  pwaTip: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 2,
    color: 'rgba(148, 163, 184, 0.92)',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  webExitFs: {
    position: 'absolute',
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(6, 6, 16, 0.92)',
  },
  webExitFsTxt: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: runitFont.black,
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

