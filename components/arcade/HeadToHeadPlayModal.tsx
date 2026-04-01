import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';

type Props = {
  visible: boolean;
  gameTitle: string;
  /** Contest participation fee in USD (cash wallet; not prize credits). */
  entryUsd: number;
  /** Pre-announced fixed reward in USD (platform-funded framing in copy). */
  prizeUsd: number;
  /** From Home open row: someone already queued vs empty slot (demo). */
  lobbyKind?: 'host_waiting' | 'empty_pool';
  onClose: () => void;
  /** Solo practice — no wallet, no credits. */
  onPractice: () => void;
  /** Paid 1v1 — opens queue (join lobby or find opponent). */
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
  lobbyKind = 'empty_pool',
}: Props) {
  const entryLabel = formatUsdFromCents(Math.round(entryUsd * 100));
  const prizeLabel = formatUsdFromCents(Math.round(prizeUsd * 100));
  const joining = lobbyKind === 'host_waiting';

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetScroll}>
          <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>HEAD-TO-HEAD</Text>
          <Text style={styles.gameName} numberOfLines={2}>
            {gameTitle}
          </Text>
          <Text style={styles.hint}>
            Arcade uses prize credits. Here you use your <Text style={styles.hintStrong}>cash wallet</Text> for contest fees and{' '}
            <Text style={styles.hintStrong}>listed prizes</Text> from Run It (skill contests — not player-vs-player wagering).
          </Text>

          <View style={styles.explainBox}>
            <View style={styles.explainTitleRow}>
              <Ionicons name="git-merge-outline" size={18} color={runit.neonCyan} />
              <Text style={styles.explainTitle}>{joining ? 'Joining this lobby' : 'Starting a match'}</Text>
            </View>
            <Text style={styles.explainLine}>
              <Text style={styles.explainBullet}>1.</Text> We charge <Text style={styles.explainEm}>{entryLabel}</Text> as your contest
              participation fee when you enter the queue (demo wallet until billing is live).
            </Text>
            <Text style={styles.explainLine}>
              <Text style={styles.explainBullet}>2.</Text>{' '}
              {joining ? (
                <>
                  Someone is already in queue for <Text style={styles.explainEm}>{gameTitle}</Text> at this reward tier — you join their
                  1v1.
                </>
              ) : (
                <>
                  No one’s in queue yet for <Text style={styles.explainEm}>{gameTitle}</Text> at this reward tier — we search for the next
                  player entering the same contest.
                </>
              )}
            </Text>
            <Text style={styles.explainLine}>
              <Text style={styles.explainBullet}>3.</Text> When it’s go time, you play — best score wins the prize of{' '}
              <Text style={styles.explainEm}>{prizeLabel}</Text> (awarded by Run It for this contest).
            </Text>
            <Text style={styles.explainFoot}>
              Prizes are set amounts from Run It; they are not pooled with or paid from other players’ entry fees. Demo matchmaking is
              instant; live servers will add fair skill pairing.
            </Text>
          </View>

          <Pressable onPress={onHeadToHeadPrize} style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.92 }]}>
            <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardBorder, runitGlowPinkSoft]}>
              <View style={styles.cardInner}>
                <View style={styles.rowTop}>
                  <Ionicons name={joining ? 'log-in-outline' : 'people-outline'} size={26} color="#FDE047" />
                  <Text style={[styles.cardTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>
                    {joining ? 'Join match' : 'Find opponent'}
                  </Text>
                </View>
                <Text style={styles.cardBody}>
                  {joining ? (
                    <>
                      Pay the contest fee and join their lobby — top score can win <Text style={styles.cardEm}>{prizeLabel}</Text>.
                    </>
                  ) : (
                    <>
                      Enter the queue — we’ll match you, then you compete for <Text style={styles.cardEm}>{prizeLabel}</Text>.
                    </>
                  )}
                </Text>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onPractice} style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.92 }]}>
            <LinearGradient colors={[runit.neonCyan, 'rgba(0,240,255,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardBorder, runitGlowPinkSoft]}>
              <View style={styles.cardInner}>
                <View style={styles.rowTop}>
                  <Ionicons name="school-outline" size={26} color={runit.neonCyan} />
                  <Text style={[styles.cardTitle, { fontFamily: runitFont.black }, runitTextGlowCyan]}>Practice only</Text>
                </View>
                <Text style={styles.cardBody}>Free solo · no wallet · learn the game first.</Text>
              </View>
            </LinearGradient>
          </Pressable>

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
    padding: 20,
  },
  sheet: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: 'rgba(6,2,14,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.45)',
    maxHeight: '92%',
  },
  sheetScroll: { paddingBottom: 4 },
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
    marginBottom: 12,
    lineHeight: 17,
  },
  hintStrong: { color: '#fde68a', fontWeight: '800' },
  explainBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.22)',
  },
  explainTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  explainTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '900',
    flex: 1,
  },
  explainLine: {
    color: 'rgba(226,232,240,0.92)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  explainBullet: { color: runit.neonCyan, fontWeight: '900' },
  explainEm: { color: '#fef08a', fontWeight: '800' },
  explainFoot: {
    marginTop: 4,
    color: 'rgba(148,163,184,0.88)',
    fontSize: 10,
    lineHeight: 14,
    fontStyle: 'italic',
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
  cardEm: { color: '#fef08a', fontWeight: '800' },
  cancelBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { color: 'rgba(148,163,184,0.95)', fontSize: 15, fontWeight: '700' },
});
