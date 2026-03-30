import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type ViewStyle, StyleSheet, Text, View } from 'react-native';

import { runit, runitFont } from '@/lib/runitArcadeTheme';

type StatConfig = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  border: readonly [string, string];
  glow: ViewStyle;
};

const STATS: StatConfig[] = [
  {
    label: 'WINS',
    value: '12',
    icon: 'trophy-outline',
    border: [runit.neonCyan, 'rgba(0,240,255,0.25)'],
    glow: {
      shadowColor: 'rgba(0, 240, 255, 0.4)',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 8,
    },
  },
  {
    label: 'RANK',
    value: 'Gold III',
    icon: 'star-outline',
    border: [runit.neonPurple, 'rgba(157,78,237,0.35)'],
    glow: {
      shadowColor: 'rgba(157, 78, 237, 0.45)',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 8,
    },
  },
  {
    label: 'STREAK',
    value: '3',
    icon: 'flame-outline',
    border: [runit.neonPink, 'rgba(255,0,110,0.35)'],
    glow: {
      shadowColor: 'rgba(255, 0, 110, 0.45)',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 8,
    },
  },
];

export function ArcadeStatsRow() {
  return (
    <View style={styles.row}>
      {STATS.map((s) => (
        <LinearGradient key={s.label} colors={s.border} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradPad, s.glow]}>
          <View style={styles.inner}>
            <Ionicons name={s.icon} size={18} color={s.border[0]} style={styles.icon} />
            <Text style={styles.lbl}>{s.label}</Text>
            <Text style={[styles.val, { fontFamily: runitFont.black }]} numberOfLines={1}>
              {s.value}
            </Text>
          </View>
        </LinearGradient>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  gradPad: {
    flex: 1,
    borderRadius: 14,
    padding: 2,
    minWidth: 0,
  },
  inner: {
    backgroundColor: runit.glass,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  icon: { marginBottom: 4 },
  lbl: {
    color: 'rgba(226, 232, 240, 0.75)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  val: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
});
