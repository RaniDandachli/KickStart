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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>FIND OPPONENT</Text>
            <Text style={styles.gameName} numberOfLines={2}>
              {gameTitle}
            </Text>
            <Text style={styles.hint}>
              Pick a <Text style={styles.hintStrong}>contest tier</Text>. We&apos;ll match you on the same game and tier. Your entry is
              contest access only; prizes are fixed by Run It. Didn&apos;t win? You&apos;ll earn Arcade Credits for the Arcade floor.
            </Text>

            {MATCH_ENTRY_TIERS.map((tier) => {
              const entry = formatUsdFromCents(Math.round(tier.entry * 100));
              const prize = formatUsdFromCents(Math.round(tier.prize * 100));
              return (
                <Pressable
                  key={`${tier.entry}-${tier.prize}`}
                  onPress={() => onSelectTier(tier)}
                  style={({ pressed }) => [styles.rowPress, pressed && { opacity: 0.92 }]}
                >
                  <LinearGradient
                    colors={[runit.neonCyan, 'rgba(0,240,255,0.25)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.rowBorder, runitGlowPinkSoft]}
                  >
                    <View style={styles.rowInner}>
                      <SafeIonicons name={tier.icon} size={22} color={runit.neonCyan} />
                      <View style={styles.rowText}>
                        <Text style={[styles.tierName, { fontFamily: runitFont.black }, runitTextGlowCyan]}>{tier.shortLabel}</Text>
                        <View style={styles.metaAccess}>
                          <Text style={styles.metaLbl}>Match access</Text>
                          <Text style={styles.metaAmt}>{entry}</Text>
                        </View>
                        <View style={styles.metaPrize}>
                          <Text style={styles.metaPrizeLbl}>🏆 Top performer prize</Text>
                          <Text style={styles.metaPrizeAmt}>{prize}</Text>
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
    padding: 18,
  },
  sheet: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(6,2,14,0.96)',
    borderWidth: 1,
    borderColor: appBorderAccent,
    maxHeight: '88%',
  },
  scroll: { paddingBottom: 8 },
  kicker: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  gameName: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 17,
  },
  hintStrong: { color: '#fde68a', fontWeight: '800' },
  rowPress: { marginBottom: 10 },
  rowBorder: { borderRadius: 14, padding: 2 },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(8,4,18,0.92)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowText: { flex: 1, gap: 8 },
  tierName: { fontSize: 16, color: '#fff', marginBottom: 2 },
  metaAccess: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
  },
  metaLbl: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaAmt: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metaPrize: {
    marginTop: 2,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(253,224,71,0.28)',
  },
  metaPrizeLbl: {
    color: 'rgba(254,243,199,0.95)',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  metaPrizeAmt: {
    color: '#FDE047',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  cancelBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { color: 'rgba(148,163,184,0.95)', fontSize: 15, fontWeight: '700' },
});
