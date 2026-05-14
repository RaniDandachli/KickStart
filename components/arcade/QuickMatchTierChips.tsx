import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { labelForQuickMatchEntryCents, QUICK_MATCH_KNOWN_ENTRY_CENTS } from '@/lib/quickMatchTiers';
import { runit, runitFont } from '@/lib/runitArcadeTheme';

type Props = {
  maxAffordableEntryCents: number;
  selected: readonly number[];
  onChange: (next: number[]) => void;
};

/** Accent colors for paid tiers (free uses ticket purple). */
const TIER_RING_COLORS = ['#22c55e', '#38bdf8', '#818cf8', '#a855f7', '#ec4899', '#eab308'] as const;

function accentForTier(entryCents: number, index: number): string {
  if (entryCents <= 0) return runit.neonPurple;
  return TIER_RING_COLORS[(index - 1) % TIER_RING_COLORS.length]!;
}

/**
 * Quick Match — card-style tier picker (neon arcade reference).
 */
export function QuickMatchTierChips({ maxAffordableEntryCents, selected, onChange }: Props) {
  const set = new Set(selected);

  function toggle(entryCents: number) {
    const next = new Set(selected);
    if (next.has(entryCents)) next.delete(entryCents);
    else next.add(entryCents);
    onChange(Array.from(next).sort((a, b) => a - b));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>CONTEST TIERS YOU&apos;RE OK WITH</Text>
        <View style={styles.multiHint}>
          <SafeIonicons name="sparkles" size={12} color={runit.neonPink} />
          <Text style={styles.multiHintTxt}>Multiple OK</Text>
        </View>
      </View>
      <Text style={styles.hint}>We only pair you on a tier you select. Free = no wallet charge.</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {QUICK_MATCH_KNOWN_ENTRY_CENTS.map((cents, index) => {
          const disabled = cents > maxAffordableEntryCents;
          const on = set.has(cents);
          const accent = accentForTier(cents, index);
          const isFree = cents <= 0;
          return (
            <Pressable
              key={cents}
              disabled={disabled}
              onPress={() => toggle(cents)}
              style={({ pressed }) => [
                styles.card,
                on && styles.cardOn,
                disabled && styles.cardDisabled,
                pressed && !disabled && { opacity: 0.9 },
              ]}
            >
              <View style={styles.cardTopRow}>
                {on ? (
                  <View style={styles.checkBubble}>
                    <SafeIonicons name="checkmark" size={14} color="#0c0618" />
                  </View>
                ) : (
                  <View style={styles.radioOuter}>
                    <View style={styles.radioInner} />
                  </View>
                )}
              </View>
              <View style={[styles.iconRing, { borderColor: accent }]}>
                {isFree ? (
                  <SafeIonicons name="ticket-outline" size={26} color={runit.neonPink} />
                ) : (
                  <SafeIonicons name="logo-usd" size={22} color={accent} />
                )}
              </View>
              <Text style={[styles.cardTitle, { fontFamily: runitFont.black }]} numberOfLines={2}>
                {isFree ? 'FREE CASUAL' : labelForQuickMatchEntryCents(cents).replace(' entry', '').toUpperCase()}
              </Text>
              {isFree ? (
                <View style={styles.freePill}>
                  <Text style={styles.freePillTxt}>No entry fee</Text>
                </View>
              ) : (
                <Text style={styles.paidSub} numberOfLines={1}>
                  Match pool
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  kicker: {
    color: 'rgba(248,250,252,0.95)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    flex: 1,
  },
  multiHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  multiHintTxt: { color: runit.neonPink, fontSize: 10, fontWeight: '800' },
  hint: { color: 'rgba(148,163,184,0.92)', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  scrollContent: { flexDirection: 'row', gap: 10, paddingBottom: 4, paddingRight: 8 },
  card: {
    width: 112,
    minHeight: 152,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(8,4,18,0.88)',
    alignItems: 'center',
  },
  cardOn: {
    borderColor: 'rgba(232,121,249,0.75)',
    backgroundColor: 'rgba(88,28,135,0.35)',
    shadowColor: runit.neonPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  cardDisabled: { opacity: 0.35 },
  cardTopRow: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  checkBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: runit.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(148,163,184,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'transparent' },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(2,6,23,0.45)',
  },
  cardTitle: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  freePill: {
    backgroundColor: 'rgba(34,197,94,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  freePillTxt: { color: '#86efac', fontSize: 9, fontWeight: '800' },
  paidSub: { color: 'rgba(148,163,184,0.85)', fontSize: 9, fontWeight: '600' },
});
