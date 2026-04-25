import { Image } from 'expo-image';
import { StyleSheet, type StyleProp, type ViewStyle, View } from 'react-native';

import { runItArcadeLogoSource } from '@/lib/brandLogo';

/** Legacy R mark — optional compact mark. */
export const WEB_RUN_IT_R_MARK = require('@/assets/images/run-it-arcade-r-mark.png');

export type WebRunItArcadeWordmarkSize = 'nav' | 'hero' | 'splash';

const CREST_H: Record<WebRunItArcadeWordmarkSize, number> = {
  nav: 36,
  hero: 48,
  splash: 64,
};

type Props = {
  size?: WebRunItArcadeWordmarkSize;
  /** Kept for API compatibility; the crest is always the full lockup. */
  layout?: 'stacked' | 'inline';
  style?: StyleProp<ViewStyle>;
};

/**
 * Web wordmark: full **Run It Arcade** crest (purple / white / gold brand lockup).
 */
export function WebRunItArcadeWordmark({ size = 'hero', layout: _layout, style }: Props) {
  const h = CREST_H[size];
  const w = h * 0.95;
  return (
    <View
      style={[styles.wrap, style]}
      accessibilityRole="image"
      accessibilityLabel="Run It Arcade"
    >
      <Image source={runItArcadeLogoSource} style={{ width: w, height: h }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
  },
});
