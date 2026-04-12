import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';

export type RunitBorderAccent = 'pink' | 'cyan' | 'purple';

interface Props {
  title: string;
  entryLabel: string;
  winLabel: string;
  /** Inner panel gradient (game identity) */
  bgColors: readonly [string, string, ...string[]];
  /** Neon border / CTA mapping */
  borderAccent: RunitBorderAccent;
  iconSlot: ReactNode;
  onPress: () => void;
  titleColor?: string;
  entryColor?: string;
  /** Stronger glow / size — e.g. Arcade “Hot games” strip */
  emphasized?: boolean;
  /** Tighter row — more games visible without scrolling */
  compact?: boolean;
}

const borderGrad: Record<RunitBorderAccent, readonly [string, string]> = {
  pink: [runit.neonPink, runit.neonPurple],
  cyan: [runit.neonCyan, 'rgba(0,240,255,0.25)'],
  purple: [runit.neonPurple, runit.neonPink],
};

export function ArcadeGameRow({
  title,
  entryLabel,
  winLabel,
  bgColors,
  borderAccent,
  iconSlot,
  onPress,
  titleColor = '#fff',
  entryColor = 'rgba(226,232,240,0.9)',
  emphasized = false,
  compact = false,
}: Props) {
  const b = borderGrad[borderAccent];
  const titleGlow = borderAccent === 'cyan' ? runitTextGlowCyan : runitTextGlowPink;
  const borderExtra = emphasized ? styles.borderWrapHot : undefined;
  const borderCompact = compact ? styles.borderWrapCompact : undefined;
  const cardExtra = emphasized ? styles.cardHot : undefined;
  const cardCompact = compact ? styles.cardCompact : undefined;
  const iconWrapExtra = emphasized ? styles.iconWrapHot : undefined;
  const iconWrapCompact = compact ? styles.iconWrapCompact : undefined;
  const titleSz = emphasized ? styles.titleHot : undefined;
  const titleCompact = compact ? styles.titleCompact : undefined;
  const entryCompact = compact ? styles.entryCompact : undefined;
  const playBtnCompact = compact ? styles.playBtnCompact : undefined;
  const playTextCompact = compact ? styles.playTextCompact : undefined;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.press,
        emphasized && styles.pressHot,
        compact && styles.pressCompact,
        pressed && { opacity: 0.92, transform: [{ scale: emphasized ? 0.985 : 0.99 }] },
      ]}
    >
      <LinearGradient
        colors={b}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderWrap, runitGlowPinkSoft, borderExtra, borderCompact]}
      >
        <LinearGradient
          colors={bgColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, cardExtra, cardCompact]}
        >
          <View style={styles.left}>
            <View style={[styles.iconWrap, iconWrapExtra, iconWrapCompact]}>{iconSlot}</View>
            <View style={styles.titleBlock}>
              <Text
                style={[styles.title, titleSz, titleCompact, { color: titleColor, fontFamily: runitFont.black }, titleGlow]}
              >
                {title}
              </Text>
              <Text style={[styles.entry, entryCompact, { color: entryColor }]}>{entryLabel}</Text>
            </View>
          </View>
          <LinearGradient
            colors={[runit.neonPink, runit.neonPurple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.playBtn, playBtnCompact]}
          >
            <Text style={[styles.playText, playTextCompact, { fontFamily: runitFont.black }]}>{winLabel}</Text>
          </LinearGradient>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { marginBottom: 12 },
  pressHot: { marginBottom: 14 },
  pressCompact: { marginBottom: 6 },
  borderWrap: {
    borderRadius: 16,
    padding: 2,
  },
  borderWrapHot: {
    padding: 3,
    shadowColor: 'rgba(255,0,110,0.65)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 14,
  },
  borderWrapCompact: {
    borderRadius: 14,
    padding: 2,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 76,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cardHot: {
    minHeight: 86,
    paddingVertical: 14,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  cardCompact: {
    minHeight: 58,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  titleBlock: { flex: 1, minWidth: 0 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconWrapHot: {
    width: 50,
    height: 50,
    borderRadius: 14,
    marginRight: 12,
  },
  iconWrapCompact: {
    width: 38,
    height: 38,
    borderRadius: 10,
    marginRight: 9,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  titleHot: {
    fontSize: 18,
  },
  titleCompact: {
    fontSize: 15,
    letterSpacing: 0.35,
  },
  entry: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  entryCompact: {
    fontSize: 10,
    marginTop: 1,
  },
  playBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    minWidth: 88,
    alignItems: 'center',
    marginLeft: 8,
  },
  playBtnCompact: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 10,
    minWidth: 72,
    marginLeft: 6,
    borderWidth: 1,
  },
  playText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  playTextCompact: {
    fontSize: 10,
    letterSpacing: 0.9,
  },
});
