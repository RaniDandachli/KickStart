import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';

import { MATCH_ENTRY_TIERS, type MatchEntryTier } from '@/components/arcade/matchEntryTiers';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont } from '@/lib/runitArcadeTheme';

const ACCENTS = ['#22c55e', '#38bdf8', '#818cf8', '#a855f7', '#ec4899', '#eab308'] as const;

function tierKey(t: MatchEntryTier) {
  return `${t.entry}-${t.prize}`;
}

function accentForIndex(i: number) {
  return ACCENTS[i % ACCENTS.length]!;
}

export type ContestTierPickCardsProps = {
  /** `select` — highlights current tier; `action` — tap-to-go (e.g. Home), chevron affordance. */
  mode: 'select' | 'action';
  selectedTier?: MatchEntryTier | null;
  onSelectTier: (tier: MatchEntryTier) => void;
  hint?: string;
  /** Right badge (sparkles + text), e.g. "Pick one tier" or "Tap to queue". */
  badgeText?: string;
  /** Wider cards + scroll snap on desktop Home. */
  webWideSnap?: boolean;
  /** Applied to the horizontal `ScrollView` (e.g. negative margin on Home). */
  scrollStyle?: StyleProp<ViewStyle>;
};

/**
 * Head-to-head contest tiers — same card chrome as Quick Match tier picker (neon arcade).
 */
export function ContestTierPickCards({
  mode,
  selectedTier = null,
  onSelectTier,
  hint = 'Match access is from your cash wallet; prizes are fixed by tier.',
  badgeText,
  webWideSnap = false,
  scrollStyle,
}: ContestTierPickCardsProps) {
  const selectedKey = selectedTier ? tierKey(selectedTier) : null;
  const cardW = webWideSnap && Platform.OS === 'web' ? 124 : 112;
  const snap = cardW + 10;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>CONTEST TIER</Text>
        {badgeText ? (
          <View style={styles.badge}>
            <SafeIonicons name="sparkles" size={12} color={runit.neonPink} />
            <Text style={styles.badgeTxt}>{badgeText}</Text>
          </View>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={Platform.OS === 'web'}
        style={scrollStyle}
        contentContainerStyle={[styles.scrollContent, { gap: 10 }]}
        {...(Platform.OS === 'web' ? { snapToInterval: snap, decelerationRate: 'fast' as const } : {})}
      >
        {MATCH_ENTRY_TIERS.map((tier, index) => {
          const accent = accentForIndex(index);
          const selected = mode === 'select' && selectedKey === tierKey(tier);
          const entry = formatUsdFromCents(Math.round(tier.entry * 100));
          const prize = formatUsdFromCents(Math.round(tier.prize * 100));
          return (
            <Pressable
              key={tierKey(tier)}
              onPress={() => onSelectTier(tier)}
              style={({ pressed }) => [
                styles.card,
                { width: cardW },
                selected && styles.cardOn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={styles.cardTopRow}>
                {mode === 'action' ? (
                  <SafeIonicons name="chevron-forward" size={16} color="rgba(148,163,184,0.75)" />
                ) : selected ? (
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
                <SafeIonicons name={tier.icon} size={24} color={accent} />
              </View>
              <Text style={[styles.cardTitle, { fontFamily: runitFont.black }]} numberOfLines={2}>
                {tier.shortLabel.toUpperCase()}
              </Text>
              <Text style={styles.metaAccess} numberOfLines={1}>
                {entry}
              </Text>
              <Text style={styles.metaArrow} numberOfLines={1}>
                →
              </Text>
              <Text style={styles.metaPrize} numberOfLines={1}>
                {prize}
              </Text>
              <Text style={styles.metaLbl}>access → prize</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeTxt: { color: runit.neonPink, fontSize: 10, fontWeight: '800' },
  hint: { color: 'rgba(148,163,184,0.92)', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  scrollContent: { flexDirection: 'row', paddingBottom: 6, paddingRight: 8 },
  card: {
    minHeight: 168,
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
  metaAccess: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metaArrow: { color: 'rgba(148,163,184,0.7)', fontSize: 10, lineHeight: 14 },
  metaPrize: {
    color: runit.gold,
    fontSize: 11,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metaLbl: {
    marginTop: 4,
    color: 'rgba(148,163,184,0.75)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
