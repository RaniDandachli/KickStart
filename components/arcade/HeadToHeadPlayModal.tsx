import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';

type Props = {
  visible: boolean;
  gameTitle: string;
  /** Entry fee in USD (deducted from cash wallet, not prize credits). */
  entryUsd: number;
  /** Listed winner prize in USD. */
  prizeUsd: number;
  onClose: () => void;
  /** Solo practice — no wallet, no credits. */
  onPractice: () => void;
  /** Paid 1v1 vs real opponent — entry fee from wallet; winner gets listed prize. */
  onHeadToHeadPrize: () => void;
};

export function HeadToHeadPlayModal({
  visible,
  gameTitle,
  entryUsd,
  prizeUsd,
  onClose,
  onPractice,
  onHeadToHeadPrize,
}: Props) {
  const entryLabel = formatUsdFromCents(Math.round(entryUsd * 100));
  const prizeLabel = formatUsdFromCents(Math.round(prizeUsd * 100));

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>HEAD-TO-HEAD</Text>
          <Text style={styles.gameName} numberOfLines={2}>
            {gameTitle}
          </Text>
          <Text style={styles.hint}>
            Prize credits & redeem tickets are for Arcade. Here you use your cash wallet for entry fees.
          </Text>

          <Pressable onPress={onPractice} style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.92 }]}>
            <LinearGradient colors={[runit.neonCyan, 'rgba(0,240,255,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardBorder, runitGlowPinkSoft]}>
              <View style={styles.cardInner}>
                <View style={styles.rowTop}>
                  <Ionicons name="school-outline" size={26} color={runit.neonCyan} />
                  <Text style={[styles.cardTitle, { fontFamily: runitFont.black }, runitTextGlowCyan]}>Practice run</Text>
                </View>
                <Text style={styles.cardBody}>Free solo · learn the game · no wallet or credits.</Text>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onHeadToHeadPrize} style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.92 }]}>
            <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardBorder, runitGlowPinkSoft]}>
              <View style={styles.cardInner}>
                <View style={styles.rowTop}>
                  <Ionicons name="wallet-outline" size={26} color="#FDE047" />
                  <Text style={[styles.cardTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>Play for prize (1v1)</Text>
                </View>
                <Text style={styles.cardBody}>
                  Entry {entryLabel} from your wallet · find a real opponent · higher score wins · listed prize {prizeLabel}{' '}
                  (winner).
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
