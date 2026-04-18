import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatUsdFromCents } from '@/lib/money';
import { appBorderAccent, runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { SKILL_CONTEST_OPERATOR_PRIZE } from '@/lib/skillContestCopy';

type Props = {
  visible: boolean;
  gameTitle: string;
  /** Contest participation fee in USD (cash wallet; not prize credits). */
  entryUsd: number;
  /** Pre-announced fixed reward in USD (platform-funded framing in copy). */
  prizeUsd: number;
  /** From Home open row: someone already queued vs empty slot. */
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
}: Props) {
  const entryLabel = formatUsdFromCents(Math.round(entryUsd * 100));
  const prizeLabel = formatUsdFromCents(Math.round(prizeUsd * 100));

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
            Arcade mode uses <Text style={styles.hintStrong}>Arcade Credits</Text>. Head-to-head uses your{' '}
            <Text style={styles.hintStrong}>cash wallet</Text> for contest access only — listed prizes are fixed by tier and awarded
            by Run It. Didn&apos;t win? You&apos;ll still earn Arcade Credits to keep playing.
          </Text>

          <View style={styles.pricingSplit}>
            <View style={styles.pricingSection}>
              <Text style={styles.pricingSectionLbl}>Match access</Text>
              <Text style={styles.pricingSectionAmt}>{entryLabel}</Text>
            </View>
            <View style={styles.pricingRule} />
            <View style={[styles.pricingSection, styles.pricingSectionPrize]}>
              <Text style={styles.pricingPrizeLbl}>🏆 Top performer prize</Text>
              <Text style={styles.pricingPrizeAmt}>{prizeLabel}</Text>
            </View>
          </View>

          <View style={styles.explainBox}>
            <View style={styles.explainTitleRow}>
              <SafeIonicons name="git-merge-outline" size={18} color={runit.neonCyan} />
              <Text style={styles.explainTitle}>Same queue for both players</Text>
            </View>
            <Text style={styles.explainLine}>
              <Text style={styles.explainBullet}>1.</Text> Your entry covers <Text style={styles.explainEm}>access</Text> to a skill
              contest when you enter the queue — <Text style={styles.explainEm}>{entryLabel}</Text> from your cash wallet (charged when
              the match is created; both players must have sufficient balance).
            </Text>
            <Text style={styles.explainLine}>
              <Text style={styles.explainBullet}>2.</Text> Host and joiner both tap the same action for{' '}
              <Text style={styles.explainEm}>{gameTitle}</Text> at this tier — you enter the same contest pool. The first person waiting pairs
              with the next person who enters (whether they opened from Home as &quot;join&quot; or &quot;find&quot;).
            </Text>
            <Text style={styles.explainLine}>
              <Text style={styles.explainBullet}>3.</Text> When it&apos;s go time, you play — top score earns the listed prize of{' '}
              <Text style={styles.explainEm}>{prizeLabel}</Text> (Run It — not a player pool). Every game earns something: losers get
              Arcade Credits for the Arcade floor.
            </Text>
            <Text style={styles.explainFoot}>
              {SKILL_CONTEST_OPERATOR_PRIZE} Arcade Credits are gameplay-only — not cash. Matchmaking may be instant while the service
              scales; pairing improves as more players queue.
            </Text>
          </View>

          <Pressable onPress={onHeadToHeadPrize} style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.92 }]}>
            <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardBorder, runitGlowPinkSoft]}>
              <View style={styles.cardInner}>
                <View style={styles.rowTop}>
                  <SafeIonicons name="git-merge-outline" size={26} color="#FDE047" />
                  <Text style={[styles.cardTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>
                    Enter match queue
                  </Text>
                </View>
                <Text style={styles.cardBody}>
                  Enter this tier&apos;s pool — when two players are ready, you compete for{' '}
                  <Text style={styles.cardEm}>{prizeLabel}</Text> (same flow whether you were first or second).
                </Text>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onPractice} style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.92 }]}>
            <LinearGradient colors={[runit.neonCyan, 'rgba(0,240,255,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardBorder, runitGlowPinkSoft]}>
              <View style={styles.cardInner}>
                <View style={styles.rowTop}>
                  <SafeIonicons name="school-outline" size={26} color={runit.neonCyan} />
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
    borderColor: appBorderAccent,
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
  pricingSplit: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
    marginBottom: 14,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  pricingSection: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingSectionPrize: {
    backgroundColor: 'rgba(30,27,75,0.55)',
  },
  pricingSectionLbl: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  pricingSectionAmt: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  pricingRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginVertical: 10,
  },
  pricingPrizeLbl: {
    color: 'rgba(254,243,199,0.95)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
    textAlign: 'center',
    lineHeight: 13,
  },
  pricingPrizeAmt: {
    color: '#FDE047',
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
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
