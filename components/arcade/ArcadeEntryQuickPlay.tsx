import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import { pushCrossTab } from '@/lib/appNavigation';
import { arcade } from '@/lib/arcadeTheme';

export { MATCH_ENTRY_TIERS };

export function ArcadeEntryQuickPlay() {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <View style={styles.ruleRow}>
        <Text style={styles.sectionTitle}>1v1 · Online</Text>
        <View style={styles.ruleLine} />
      </View>
      <Text style={styles.sub}>Contest fee · matchmake · top score wins the listed prize (Run It–funded)</Text>
      <Text style={styles.hint}>Vs AI below is practice — no entry</Text>

      {MATCH_ENTRY_TIERS.map((tier) => (
        <Pressable
          key={tier.entry}
          onPress={() => {
            const ec = Math.round(tier.entry * 100);
            const pc = Math.round(tier.prize * 100);
            pushCrossTab(
              router,
              `/(app)/(tabs)/play/casual?entryCents=${ec}&prizeCents=${pc}&entry=${encodeURIComponent(String(tier.entry))}&prize=${encodeURIComponent(String(tier.prize))}`,
            );
          }}
          style={({ pressed }) => [styles.cardOuter, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={['#0d9488', '#14b8a6', '#0f766e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.cardLeft}>
              <View style={styles.badge}>
                <SafeIonicons name={tier.icon} size={18} color="#FFFBEB" />
              </View>
              <View>
                <Text style={styles.entryLine}>
                  Fee <Text style={styles.entryUsd}>${tier.entry}</Text>
                </Text>
                <Text style={styles.prizeLine}>Prize ${tier.prize}</Text>
              </View>
            </View>
            <LinearGradient colors={['#15803d', '#16a34a', '#22c55e']} style={styles.findBtn}>
              <Text style={styles.findText}>FIND MATCH</Text>
            </LinearGradient>
          </LinearGradient>
        </Pressable>
      ))}

      <Text style={styles.disclaimer}>
        Open queue — contest access uses your cash wallet when you enter a paid tier; prizes are paid by Run It, not pooled from players.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 8 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  sectionTitle: {
    color: arcade.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  ruleLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(94, 234, 212, 0.35)',
    marginLeft: 4,
  },
  sub: {
    color: arcade.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  hint: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardOuter: {
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 76,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryLine: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  entryUsd: {
    color: '#FFFBEB',
    fontWeight: '900',
    fontSize: 17,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  prizeLine: {
    color: '#ECFDF5',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  findBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    minWidth: 108,
    alignItems: 'center',
  },
  findText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  disclaimer: {
    marginTop: 4,
    textAlign: 'center',
    color: arcade.textMuted,
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.85,
  },
});
