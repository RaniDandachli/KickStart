import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';

type Props = {
  title: string;
  subtitle?: string;
  /** Small label above the title (e.g. tab context). */
  eyebrow?: string;
  align?: 'left' | 'center';
  /** Extra row under subtitle (e.g. chips). */
  children?: ReactNode;
  style?: ViewStyle;
};

/**
 * Consistent page title stack for tab screens — spacing, type scale, and glow match Run It chrome.
 */
export function ScreenHeader({ title, subtitle, eyebrow, align = 'left', children, style }: Props) {
  const a = align === 'center' ? 'center' : 'left';
  return (
    <View style={[styles.wrap, { alignItems: align === 'center' ? 'center' : 'stretch' }, style]}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { textAlign: a }]} accessibilityRole="text">
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={[
          styles.title,
          { fontFamily: runitFont.black, textAlign: a },
          runitTextGlowPink,
        ]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { textAlign: a }]} accessibilityRole="text">
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
    paddingTop: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: 'rgba(226, 232, 240, 0.52)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#F8FAFC',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: 'rgba(203, 213, 225, 0.9)',
    maxWidth: 560,
    alignSelf: 'stretch',
  },
});
