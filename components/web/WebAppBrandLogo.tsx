import { useSegments } from 'expo-router';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WebRunItArcadeWordmark } from '@/components/web/WebRunItArcadeWordmark';
import { useWebUsesTopTabBar } from '@/hooks/useWebUsesTopTabBar';
import { isWebLaptopViewport } from '@/lib/homeWebLayout';
import { WEB_TOP_TAB_BAR_ROW_HEIGHT_PX } from '@/lib/tabBarStyle';

/** Width reserved for the R mark + “UN iT Arcade” + gap so top tabs don’t overlap (desktop web). */
export const WEB_TOP_LOGO_SLOT_PX = 228;

const WORDMARK_ROW_H = 32;
/**
 * Web-only (desktop top tabs): compact Run iT Arcade wordmark — top-left beside the tab strip.
 * Narrow web keeps the in-page hero; avoids overlapping mobile Safari layouts.
 */
export function WebAppBrandLogo() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const segments = useSegments() as readonly string[];
  const desktopTopTabs = useWebUsesTopTabBar();
  /** Home tab uses the laptop landing layout with its own wordmark; hide the floating corner logo. */
  const isHomeTab =
    segments[0] === '(app)' &&
    segments[1] === '(tabs)' &&
    (segments.length === 2 || (segments.length === 3 && segments[2] === 'index'));

  if (Platform.OS !== 'web' || !desktopTopTabs) return null;
  if (isHomeTab && isWebLaptopViewport(width)) return null;

  const padTop = Math.max(insets.top, 6) + 1;
  const top = padTop + (WEB_TOP_TAB_BAR_ROW_HEIGHT_PX - WORDMARK_ROW_H) / 2;
  return (
    <View style={[styles.corner, { top, left: Math.max(insets.left, 16) }]} pointerEvents="none">
      <WebRunItArcadeWordmark size="nav" layout="inline" />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    zIndex: 1500,
  },
});
