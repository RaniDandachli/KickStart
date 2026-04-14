import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';

type ModalProps = {
  visible: boolean;
  gameTitle: string;
  onClose: () => void;
  onPractice: () => void;
  onPrizeRun: () => void;
  /** Defaults to standard arcade entry (10). Turbo Arena uses 20. */
  prizeEntryCredits?: number;
};

export function ArcadePlayModeModal({
  visible,
  gameTitle,
  onClose,
  onPractice,
  onPrizeRun,
  prizeEntryCredits = PRIZE_RUN_ENTRY_CREDITS,
}: ModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>HOW DO YOU WANT TO PLAY?</Text>
          <Text style={styles.gameName} numberOfLines={2}>
            {gameTitle}
          </Text>
          <Text style={styles.hint}>Choose before you start — you can change next time.</Text>

          <Pressable onPress={onPractice} style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.92 }]}>
            <LinearGradient colors={[runit.neonCyan, 'rgba(0,240,255,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardBorder, runitGlowPinkSoft]}>
              <View style={styles.cardInner}>
                <View style={styles.rowTop}>
                  <SafeIonicons name="school-outline" size={26} color={runit.neonCyan} />
                  <Text style={[styles.cardTitle, { fontFamily: runitFont.black }, runitTextGlowCyan]}>Practice run</Text>
                </View>
                <Text style={styles.cardBody}>Free · no prize credits spent — learn the game.</Text>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onPrizeRun} style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.92 }]}>
            <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardBorder, runitGlowPinkSoft]}>
              <View style={styles.cardInner}>
                <View style={styles.rowTop}>
                  <SafeIonicons name="diamond-outline" size={26} color="#FDE047" />
                  <Text style={[styles.cardTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>Play for prizes</Text>
                </View>
                <Text style={styles.cardBody}>
                  Costs {prizeEntryCredits} prize credits to start · win more credits (skill contest). Use tickets in Prizes
                  to redeem physical rewards.
                </Text>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
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
    padding: 20,
  },
  sheet: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: 'rgba(6,2,14,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.45)',
  },
  kicker: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  gameName: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 17,
  },
  cardPress: { marginBottom: 12 },
  cardBorder: { borderRadius: 14, padding: 2 },
  cardInner: {
    backgroundColor: 'rgba(8,4,18,0.92)',
    borderRadius: 12,
    padding: 14,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardTitle: { fontSize: 17, color: '#fff', flex: 1 },
  cardBody: { color: 'rgba(226,232,240,0.92)', fontSize: 13, lineHeight: 18, paddingLeft: 36 },
  cancelBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { color: 'rgba(148,163,184,0.95)', fontSize: 15, fontWeight: '700' },
});
