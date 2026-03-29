import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { arcade } from '@/lib/arcadeTheme';

type WinTone = 'lime' | 'sky' | 'orange';

interface Props {
  title: string;
  entryLabel: string;
  winLabel: string;
  /** Background gradient colors for the row */
  bgColors: readonly [string, string, ...string[]];
  winTone: WinTone;
  iconSlot: ReactNode;
  onPress: () => void;
  titleColor?: string;
  entryColor?: string;
}

const winGradients: Record<WinTone, readonly [string, string]> = {
  lime: ['#22C55E', '#16A34A'],
  sky: [arcade.skyDeep, arcade.sky],
  orange: [arcade.orangeDeep, arcade.orange],
};

export function ArcadeGameRow({
  title,
  entryLabel,
  winLabel,
  bgColors,
  winTone,
  iconSlot,
  onPress,
  titleColor = '#fff',
  entryColor = 'rgba(15,23,42,0.85)',
}: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.press, pressed && { opacity: 0.92 }]}>
      <LinearGradient colors={bgColors} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.card}>
        <View style={styles.left}>
          <View style={styles.iconWrap}>{iconSlot}</View>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        </View>
        <Text style={[styles.entry, { color: entryColor }]}>{entryLabel}</Text>
        <LinearGradient colors={winGradients[winTone]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.winBtn}>
          <Text style={styles.winText}>{winLabel}</Text>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    minHeight: 72,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flexShrink: 1,
  },
  entry: {
    color: 'rgba(15,23,42,0.85)',
    fontSize: 11,
    fontWeight: '800',
    marginRight: 8,
    maxWidth: 72,
    textAlign: 'center',
  },
  winBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    minWidth: 96,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    elevation: 3,
  },
  winText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
