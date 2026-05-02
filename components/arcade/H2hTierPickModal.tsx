import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MATCH_ENTRY_TIERS, type MatchEntryTier } from '@/components/arcade/matchEntryTiers';
import { formatUsdFromCents } from '@/lib/money';
import { appBorderAccent, runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan } from '@/lib/runitArcadeTheme';

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
            <Text style={styles.gameName} numberOfLines={2}>
              {gameTitle}
            </Text>
            <Text style={styles.hint}>
              Same game & tier matchmaking. Entry is access only; prizes are Run It–listed. Losers still earn Arcade
              Credits.
            </Text>

            {MATCH_ENTRY_TIERS.map((tier) => {
              const entry = formatUsdFromCents(Math.round(tier.entry * 100));
              const prize = formatUsdFromCents(Math.round(tier.prize * 100));
              return (
                <Pressable
                  key={`${tier.entry}-${tier.prize}`}
                  onPress={() => onSelectTier(tier)}
                  style={({ pressed }) => [styles.rowPress, pressed && { opacity: 0.92 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${tier.shortLabel}, match access ${entry}, top prize ${prize}`}
                >
                  <LinearGradient
                    colors={[runit.neonCyan, 'rgba(0,240,255,0.25)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.rowBorder, runitGlowPinkSoft]}
                  >
                    <View style={styles.rowInner}>
                      <SafeIonicons name={tier.icon} size={22} color={runit.neonCyan} />
                      <View style={styles.rowMain}>
                        <Text style={[styles.tierName, { fontFamily: runitFont.black }, runitTextGlowCyan]} numberOfLines={1}>
                          {tier.shortLabel}
                        </Text>
                        <View style={styles.amountsRow}>
                          <View style={styles.amountChip}>
                            <Text style={styles.chipLbl}>Match</Text>
                            <Text style={styles.chipEntry}>{entry}</Text>
                          </View>
                          <View style={styles.amountDivider} />
                          <View style={styles.amountChip}>
                            <Text style={styles.chipLbl}>Prize</Text>
                            <Text style={styles.chipPrize}>{prize}</Text>
                          </View>
                        </View>
                      </View>
                      <SafeIonicons name="chevron-forward" size={18} color="rgba(148,163,184,0.9)" />
                    </View>
                  </LinearGradient>
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
    backgroundColor: 'rgba(6,2,14,0.96)',
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
    marginBottom: 4,
  },
  hint: {
    color: 'rgba(148,163,184,0.88)',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 15,
    paddingHorizontal: 4,
  },
  rowPress: {
    marginBottom: 6,
  },
  rowBorder: {
    borderRadius: 12,
    padding: 1.5,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(8,4,18,0.92)',
    borderRadius: 11,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  tierName: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 4,
  },
  amountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountChip: {
    flex: 1,
    minWidth: 0,
  },
  chipLbl: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 1,
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
    marginTop: 2,
  },
  cancelText: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 14,
    fontWeight: '700',
  },
});
