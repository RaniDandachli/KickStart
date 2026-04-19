import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { runit, runitFont } from '@/lib/runitArcadeTheme';

export const WEB_RUN_IT_R_MARK = require('@/assets/images/run-it-arcade-r-mark.png');

export type WebRunItArcadeWordmarkSize = 'nav' | 'hero' | 'splash';

const MARK_HEIGHT: Record<WebRunItArcadeWordmarkSize, number> = {
  nav: 28,
  hero: 40,
  splash: 48,
};

const FONT: Record<WebRunItArcadeWordmarkSize, { line1: number; line2: number; inline: number }> = {
  nav: { line1: 12, line2: 14, inline: 13 },
  hero: { line1: 13, line2: 17, inline: 17 },
  splash: { line1: 22, line2: 28, inline: 24 },
};

type Props = {
  size?: WebRunItArcadeWordmarkSize;
  /** `stacked`: R mark + two lines (UN iT / Arcade). `inline`: R mark + “UN iT Arcade” on one line. */
  layout?: 'stacked' | 'inline';
  style?: StyleProp<ViewStyle>;
};

/**
 * Web wordmark: stylized **R** logo + “UN iT Arcade” (the R is only in the artwork).
 */
export function WebRunItArcadeWordmark({ size = 'hero', layout = 'inline', style }: Props) {
  const h = MARK_HEIGHT[size];
  const f = FONT[size];

  const mark = (
    <View style={[styles.markFrame, layout === 'inline' && styles.markFrameInline]}>
      <LinearGradient
        colors={['rgba(0, 240, 255, 0.16)', 'rgba(255, 0, 110, 0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={WEB_RUN_IT_R_MARK}
        style={{ height: h, width: h * 0.88 }}
        contentFit="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  );

  if (layout === 'inline') {
    return (
      <View
        style={[styles.row, styles.rowInline, style]}
        accessibilityRole="text"
        accessibilityLabel="Run It Arcade"
      >
        {mark}
        <Text
          style={[
            styles.inlineRoot,
            { fontSize: f.inline, lineHeight: f.inline * 1.15 },
            { fontFamily: runitFont.black },
          ]}
        >
          <Text style={styles.inlineUn}>UN </Text>
          <Text style={styles.inlineIt}>iT </Text>
          <Text style={styles.inlineArcade}>Arcade</Text>
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="text"
      accessibilityLabel="Run It Arcade"
    >
      {mark}
      <View style={styles.textCol}>
        <Text
          style={[
            styles.line1,
            { fontSize: f.line1, lineHeight: f.line1 + 5 },
            { fontFamily: runitFont.black },
          ]}
        >
          UN iT
        </Text>
        <Text
          style={[
            styles.line2,
            { fontSize: f.line2, lineHeight: f.line2 + 5 },
            { fontFamily: runitFont.black },
          ]}
        >
          Arcade
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  /** One baseline: cap height lines up with the R loop; bolt tail hangs below text naturally. */
  rowInline: {
    alignItems: 'center',
  },
  /**
   * Cyan→pink wash + rim so the PNG (slightly different blues) reads as part of Run iT chrome,
   * not a pasted asset.
   */
  markFrame: {
    borderRadius: 13,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 3,
    marginRight: -6,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.32)',
    shadowColor: runit.neonPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  markFrameInline: {
    marginTop: -2,
  },
  textCol: {
    justifyContent: 'center',
    marginLeft: -2,
  },
  line1: {
    color: '#e8f4ff',
    letterSpacing: 1.1,
    fontWeight: '900',
  },
  line2: {
    color: runit.neonPink,
    letterSpacing: 1.2,
    fontWeight: '900',
  },
  inlineRoot: {
    color: '#f8fafc',
    fontWeight: '900',
    flexShrink: 1,
    marginLeft: -2,
  },
  /** Cool white — bridges the logo’s electric blue to body text. */
  inlineUn: {
    color: '#e8f4ff',
    letterSpacing: 0.6,
  },
  inlineIt: {
    color: runit.neonCyan,
    letterSpacing: 0.4,
  },
  inlineArcade: {
    color: runit.neonPink,
    letterSpacing: 0.5,
  },
});
