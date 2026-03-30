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
}: Props) {
  const b = borderGrad[borderAccent];
  const titleGlow = borderAccent === 'cyan' ? runitTextGlowCyan : runitTextGlowPink;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
    >
      <LinearGradient colors={b} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.borderWrap, runitGlowPinkSoft]}>
        <LinearGradient colors={bgColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <View style={styles.left}>
            <View style={styles.iconWrap}>{iconSlot}</View>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: titleColor, fontFamily: runitFont.black }, titleGlow]}>
                {title}
              </Text>
              <Text style={[styles.entry, { color: entryColor }]}>{entryLabel}</Text>
            </View>
          </View>
          <LinearGradient
            colors={[runit.neonPink, runit.neonPurple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.playBtn}
          >
            <Text style={[styles.playText, { fontFamily: runitFont.black }]}>{winLabel}</Text>
          </LinearGradient>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { marginBottom: 12 },
  borderWrap: {
    borderRadius: 16,
    padding: 2,
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
  title: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  entry: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
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
  playText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.2,
  },
});
