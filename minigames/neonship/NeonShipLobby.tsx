import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { COLORS } from '@/minigames/neonship/constants';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { onStart: () => void; onBack: () => void };

export function NeonShipLobby({ onStart, onBack }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bgGlow} pointerEvents="none" />

      <Pressable style={styles.back} onPress={onBack} hitSlop={12}>
        <SafeIonicons name="chevron-back" size={26} color="rgba(232,121,249,0.85)" />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.icon}>🚀</Text>
        <Text style={styles.title}>Void Glider</Text>
        <Text style={styles.sub}>
          Constant forward flight through a shifting neon corridor.{'\n'}
          Hold thrust to climb — release to fall. One scrape and you are done.
        </Text>
      </View>

      <View style={styles.rulesCard}>
        <RuleRow icon="⬆️" color={COLORS.shipFill} label="Thrust" desc="Hold (or Space) to push upward against gravity." />
        <View style={styles.ruleDivider} />
        <RuleRow icon="▦" color={COLORS.blockEdge} label="Corridor" desc="Stay between the purple slabs — they shrink the lane over time." />
        <View style={styles.ruleDivider} />
        <RuleRow icon="▲" color={COLORS.spike} label="Spikes" desc="Pink triangles jut into the corridor from walls — dodge them." />
        <View style={styles.ruleDivider} />
        <RuleRow icon="✦" color="#f472b6" label="Distance" desc="Your score is how far you glide before a crash." />
      </View>

      <Pressable onPress={onStart} style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.startTxt}>Launch run</Text>
      </Pressable>

      {Platform.OS === 'web' ? (
        <Text style={styles.hint}>Space — start · Hold Space in-game — thrust up</Text>
      ) : null}
    </View>
  );
}

function RuleRow({
  icon,
  color,
  label,
  desc,
}: {
  icon: string;
  color: string;
  label: string;
  desc: string;
}) {
  return (
    <View style={styles.ruleRow}>
      <View
        style={[
          styles.ruleIconWrap,
          {
            borderColor: color + '44',
            backgroundColor: color + '16',
          },
        ]}
      >
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
    paddingTop: 52,
    paddingBottom: 32,
    justifyContent: 'space-between',
    backgroundColor: COLORS.skyTop,
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: COLORS.blockEdge,
    opacity: 0.06,
  },
  back: {
    position: 'absolute',
    top: 10,
    left: 8,
    zIndex: 2,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 36,
    marginBottom: 8,
  },
  title: {
    color: COLORS.hud,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sub: {
    color: COLORS.hudMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  rulesCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(10,4,20,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(232,121,249,0.22)',
    padding: 8,
    flex: 1,
    marginVertical: 16,
    justifyContent: 'space-evenly',
  },
  ruleDivider: {
    height: 1,
    backgroundColor: 'rgba(232,121,249,0.12)',
    marginHorizontal: 4,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  ruleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ruleIcon: { fontSize: 18 },
  ruleText: { flex: 1 },
  ruleName: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  ruleDesc: {
    color: 'rgba(200,180,220,0.78)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  startBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.blockEdge,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.blockEdge,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  startTxt: {
    color: '#1a0524',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hint: {
    textAlign: 'center',
    color: 'rgba(200,180,220,0.55)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
});