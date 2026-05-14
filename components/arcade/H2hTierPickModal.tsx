import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MATCH_ENTRY_TIERS, type MatchEntryTier } from '@/components/arcade/matchEntryTiers';
import { formatUsdFromCents } from '@/lib/money';
import { appBorderAccent, runit, runitFont, runitShell, runitTextGlowPink } from '@/lib/runitArcadeTheme';

const ACCENTS = ['#22c55e', '#38bdf8', '#818cf8', '#a855f7', '#ec4899', '#eab308'] as const;

type Props = {
  visible: boolean;
  gameTitle: string;
  onClose: () => void;
  /** User picked a preset contest tier — navigate to casual queue with these amounts. */
  onSelectTier: (tier: MatchEntryTier) => void;
};

export function H2hTierPickModal({ visible, gameTitle, onClose, onSelectTier }: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>FIND OPPONENT</Text>
            <Text style={[styles.gameName, { fontFamily: runitFont.black }]} numberOfLines={2}>
              {gameTitle}
            </Text>
            <Text style={styles.hint}>
              Same game & tier matchmaking. Entry is access only; prizes are Run It–listed. Losers still earn Arcade
              Credits.
            </Text>

            <Text style={[styles.sectionHead, { fontFamily: runitFont.black }]}>CONTEST TIER</Text>
            <Text style={styles.sectionSub}>Tap a tier to queue — same card style as Quick Match.</Text>

            {MATCH_ENTRY_TIERS.map((tier, i) => {
              const accent = ACCENTS[i % ACCENTS.length]!;
              const entry = formatUsdFromCents(Math.round(tier.entry * 100));
              const prize = formatUsdFromCents(Math.round(tier.prize * 100));
              return (
                <Pressable
                  key={`${tier.entry}-${tier.prize}`}
                  onPress={() => onSelectTier(tier)}
                  style={({ pressed }) => [styles.tierCard, pressed && { opacity: 0.92 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${tier.shortLabel}, match access ${entry}, top prize ${prize}`}
                >
                  <View style={[styles.iconRing, { borderColor: accent }]}>
                    <SafeIonicons name={tier.icon} size={22} color={accent} />
                  </View>
                  <View style={styles.tierMid}>
                    <Text style={[styles.tierName, { fontFamily: runitFont.black }, runitTextGlowPink]} numberOfLines={1}>
                      {tier.shortLabel.toUpperCase()}
                    </Text>
                    <View style={styles.amountsRow}>
                      <View style={styles.amountCol}>
                        <Text style={styles.chipLbl}>Match access</Text>
                        <Text style={styles.chipEntry}>{entry}</Text>
                      </View>
                      <View style={styles.amountDivider} />
                      <View style={styles.amountCol}>
                        <Text style={styles.chipLbl}>Top prize</Text>
                        <Text style={styles.chipPrize}>{prize}</Text>
                      </View>
                    </View>
                  </View>
                  <SafeIonicons name="chevron-forward" size={20} color="rgba(148,163,184,0.85)" />
                </Pressable>
              );
            })}

            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,15,0.88)',
    justifyContent: 'center',
    padding: 14,
  },
  sheet: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: runitShell.scrim96,
    borderWidth: 1,
    borderColor: appBorderAccent,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  scroll: {
    paddingBottom: 4,
    flexGrow: 1,
  },
  kicker: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },
  gameName: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  hint: {
    color: 'rgba(148,163,184,0.88)',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 15,
    paddingHorizontal: 4,
  },
  sectionHead: {
    color: 'rgba(248,250,252,0.95)',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sectionSub: {
    color: 'rgba(148,163,184,0.88)',
    fontSize: 11,
    marginBottom: 10,
    lineHeight: 15,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.45)',
    backgroundColor: 'rgba(8,4,18,0.88)',
  },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.45)',
  },
  tierMid: { flex: 1, minWidth: 0 },
  tierName: {
    fontSize: 13,
    color: runit.neonPink,
    marginBottom: 6,
  },
  amountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountCol: {
    flex: 1,
    minWidth: 0,
  },
  chipLbl: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  chipEntry: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  chipPrize: {
    color: '#FDE047',
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  amountDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginVertical: 2,
  },
  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  cancelText: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 14,
    fontWeight: '700',
  },
});
