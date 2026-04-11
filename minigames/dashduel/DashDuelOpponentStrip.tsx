import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  p1Alive: boolean;
  p2Alive: boolean;
  p1Dist: number;
  p2Dist: number;
  p1Flash: number;
  compact?: boolean;
};

function safeBarFlex(n: number): number {
  const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  /** `flex: NaN` / 0 can crash native layout; keep a positive ratio. */
  return Math.max(1, v);
}

export function DashDuelOpponentStrip({ p1Alive, p2Alive, p1Dist, p2Dist, p1Flash, compact }: Props) {
  const a = safeBarFlex(p1Dist);
  const b = safeBarFlex(p2Dist);

  const av = compact ? styles.avSm : undefined;
  const metaSt = compact ? styles.metaSm : undefined;

  return (
    <View style={[styles.strip, compact && styles.stripSm]}>
      <View style={styles.row}>
        <LinearGradient colors={['#22D3EE', '#34D399']} style={[styles.avatarYou, av]}>
          <Text style={[styles.avText, compact && styles.avTextSm]}>You</Text>
        </LinearGradient>
        <View style={styles.mid}>
          <View style={styles.barBg}>
            <View style={[styles.barYou, { flex: a }]} />
            <View style={[styles.barAi, { flex: b }]} />
          </View>
          <Text style={[styles.meta, metaSt]}>
            {p1Alive ? (p2Alive ? 'Racing' : 'You ahead') : 'Eliminated'}
            {!p2Alive && p1Alive ? ' · Rival out' : null}
          </Text>
        </View>
        <LinearGradient colors={['#A78BFA', '#6366F1']} style={[styles.avatarAi, av]}>
          <Text style={[styles.avText, compact && styles.avTextSm]}>Rival</Text>
        </LinearGradient>
      </View>
      {p1Flash > 0.15 ? <View style={styles.dangerBar} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { width: '100%', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarYou: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarAi: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avText: { color: '#0f172a', fontSize: 10, fontWeight: '900' },
  mid: { flex: 1 },
  barBg: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.85)',
  },
  barYou: { backgroundColor: 'rgba(52,211,153,0.85)' },
  barAi: { backgroundColor: 'rgba(167,139,250,0.75)' },
  meta: {
    marginTop: 4,
    color: 'rgba(148,163,184,0.95)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  dangerBar: {
    marginTop: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(248,113,113,0.85)',
  },
  stripSm: { marginBottom: 4 },
  avSm: { width: 32, height: 32, borderRadius: 8 },
  avTextSm: { fontSize: 9 },
  metaSm: { fontSize: 9, marginTop: 2 },
});
