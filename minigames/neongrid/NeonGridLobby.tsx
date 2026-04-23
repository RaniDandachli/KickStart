import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { onStart: () => void; onBack: () => void };

export function NeonGridLobby({ onStart, onBack }: Props) {
  return (
    <View style={styles.wrap}>
      {/* Background glow orb */}
      <View style={styles.bgGlow} pointerEvents="none" />

      <Pressable style={styles.back} onPress={onBack} hitSlop={12}>
        <SafeIonicons name="chevron-back" size={26} color="rgba(220,190,120,0.85)" />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.foxIcon}>✦</Text>
        <Text style={styles.title}>Spirit Cross</Text>
        <Text style={styles.sub}>
          Hop across roads and rivers.{'\n'}
          Ride logs over water — touch water and it's over.
        </Text>
      </View>

      {/* How to play cards */}
      <View style={styles.rulesWrap}>
        <RuleRow icon="🌿" label="Grass" desc="Safe to stand on. Trees block your path." color="#2D7A2D" />
        <RuleRow icon="🚗" label="Road" desc="Cars move fast — hop through gaps." color="#FF6B35" />
        <RuleRow icon="🌊" label="River" desc="Jump on logs to cross. Don't fall in." color="#2A7AC4" />
        <RuleRow icon="✦" label="Spirit nodes" desc="Collect them to charge your Spirit ability." color="#FFD700" />
      </View>

      <Pressable onPress={onStart} style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}>
        <Text style={styles.startTxt}>Ready to cross</Text>
      </Pressable>

      {Platform.OS === 'web' ? (
        <Text style={styles.hint}>Space — start · WASD / arrows — move · Space mid-game — spirit</Text>
      ) : null}
    </View>
  );
}

function RuleRow({
  icon,
  label,
  desc,
  color,
}: {
  icon: string;
  label: string;
  desc: string;
  color: string;
}) {
  return (
    <View style={styles.ruleRow}>
      <View style={[styles.ruleIconWrap, { borderColor: color + '44', backgroundColor: color + '14' }]}>
        <Text style={styles.ruleIcon}>{icon}</Text>
      </View>
      <View style={styles.ruleText}>
        <Text style={[styles.ruleName, { color }]}>{label}</Text>
        <Text style={styles.ruleDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    justifyContent: 'space-between',
    backgroundColor: '#07100F',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#FFD700',
    opacity: 0.04,
  },
  back: { position: 'absolute', top: 10, left: 8, zIndex: 2, padding: 8 },

  header: { alignItems: 'center', marginBottom: 8 },
  foxIcon: {
    fontSize: 36,
    color: '#FFD700',
    textShadowColor: '#FF8C00',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
    marginBottom: 8,
  },
  title: {
    color: '#F5E6C0',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sub: {
    color: 'rgba(180,150,90,0.85)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },

  rulesWrap: {
    borderRadius: 16,
    backgroundColor: 'rgba(15,18,12,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(140,100,40,0.2)',
    padding: 12,
    gap: 8,
  },

  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  ruleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleIcon: { fontSize: 18 },
  ruleText: { flex: 1 },
  ruleName: { fontSize: 13, fontWeight: '800', marginBottom: 1 },
  ruleDesc: { color: 'rgba(160,140,100,0.8)', fontSize: 12, fontWeight: '500' },

  startBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
    marginTop: 8,
  },
  startBtnPressed: { opacity: 0.8 },
  startTxt: {
    color: '#0A0A0A',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  hint: {
    textAlign: 'center',
    color: 'rgba(140,110,60,0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
});