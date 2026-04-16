import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWebUsesTopTabBar } from '@/hooks/useWebUsesTopTabBar';

const LOGO = require('@/assets/images/run-it-arcade-logo.png');

/** Width reserved for the logo + gap so top tabs don’t overlap (desktop web). Export for tab bar padding. */
export const WEB_TOP_LOGO_SLOT_PX = 144;

const DESKTOP_W = 124;
const DESKTOP_H = 34;
/**
 * Web-only (desktop top tabs): compact Run iT Arcade wordmark — top-left beside the tab strip.
 * Narrow web keeps the in-page hero; avoids overlapping mobile Safari layouts.
 */
export function WebAppBrandLogo() {
  const insets = useSafeAreaInsets();
  const desktopTopTabs = useWebUsesTopTabBar();

  if (Platform.OS !== 'web' || !desktopTopTabs) return null;

  const padTop = Math.max(insets.top, 10) + 4;
  const barContentH = 52;
  const top = padTop + (barContentH - DESKTOP_H) / 2;
  return (
    <View style={[styles.corner, { top, left: Math.max(insets.left, 16) }]} pointerEvents="none">
      <Image
        source={LOGO}
        style={styles.desktopImg}
        contentFit="contain"
        accessibilityLabel="Run iT Arcade"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    zIndex: 1500,
  },
  desktopImg: {
    width: DESKTOP_W,
    height: DESKTOP_H,
  },
});
