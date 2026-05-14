import type { ComponentProps } from 'react';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { TapDashLogo } from '@/components/arcade/TapDashLogo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatUsdFromCents } from '@/lib/money';
import type { H2hGameKey } from '@/lib/homeOpenMatches';
import { runit, runitFont, runitGlowPinkSoft, runitShell } from '@/lib/runitArcadeTheme';
import { SKILL_CONTEST_OPERATOR_PRIZE } from '@/lib/skillContestCopy';

/** Practice / solo accents — real cyan (theme `neonCyan` is brand gold). */
const NEON_CYAN = '#22d3ee';

type Props = {
  visible: boolean;
  gameTitle: string;
  /** When `tap-dash`, shows arcade reference background + wordmark. */
  gameKey?: H2hGameKey;
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

function MiniFeat({
  icon,
  label,
  color = 'rgba(226,232,240,0.88)',
}: {
  icon: ComponentProps<typeof SafeIonicons>['name'];
  label: string;
  color?: string;
}) {
  return (
    <View style={styles.miniFeat}>
      <SafeIonicons name={icon} size={15} color={color} />
      <Text style={styles.miniFeatLbl} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function TrustItem({ icon, text }: { icon: ComponentProps<typeof SafeIonicons>['name']; text: string }) {
  return (
    <View style={styles.trustItem}>
      <SafeIonicons name={icon} size={16} color="rgba(167,139,250,0.75)" />
      <Text style={styles.trustTxt}>{text}</Text>
    </View>
  );
}

export function HeadToHeadPlayModal({
  visible,
  gameTitle,
  gameKey,
  entryUsd,
  prizeUsd,
  onClose,
  onPractice,
  onHeadToHeadPrize,
}: Props) {
  const entryLabel = formatUsdFromCents(Math.round(entryUsd * 100));
  const prizeLabel = formatUsdFromCents(Math.round(prizeUsd * 100));
  const tapDash = gameKey === 'tap-dash';

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {tapDash ? (
          <Image
            source={require('@/assets/how-it-works/04-tap-dash.png')}
            style={styles.bgPhoto}
            contentFit="cover"
            transition={0}
          />
        ) : null}
        <LinearGradient
          colors={['#0B0B0D', '#121214', '#161618', '#101012']}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', 'rgba(168,85,247,0.06)', 'transparent']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 0.4 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            <Pressable onPress={onClose} style={({ pressed }) => [styles.backRow, pressed && styles.backPressed]} hitSlop={12}>
              <SafeIonicons name="chevron-back" size={22} color={runit.gold} />
              <Text style={styles.backTxt}>Back</Text>
            </Pressable>

            {tapDash ? (
              <View style={styles.brandBlock}>
                <TapDashLogo size={52} rounded={false} />
                <Image
                  source={require('@/assets/images/tap-dash-logo.png')}
                  style={styles.wordmark}
                  contentFit="contain"
                  transition={0}
                />
              </View>
            ) : (
              <View style={styles.genericBrand}>
                <SafeIonicons name="game-controller" size={40} color={runit.neonPurple} />
                <Text style={[styles.genericTitle, { fontFamily: runitFont.black }]} numberOfLines={2}>
                  {gameTitle}
                </Text>
              </View>
            )}

            <Text style={styles.intro}>
              Arcade mode uses <Text style={styles.introHi}>Arcade Credits</Text>. Head-to-head uses your{' '}
              <Text style={styles.introHi}>cash wallet</Text> for contest access only — listed prizes are fixed by tier and awarded by Run
              It. Didn&apos;t win? You&apos;ll still earn Arcade Credits to keep playing.
            </Text>

            <View style={styles.matchShell}>
              <SafeIonicons name="ribbon-outline" size={120} color="rgba(88,28,135,0.16)" style={styles.lightningBg} />
              <View style={styles.pricingRow}>
                <View style={styles.pricingHalf}>
                  <SafeIonicons name="ticket-outline" size={22} color={runit.neonPurple} />
                  <Text style={styles.matchAccessLbl}>MATCH ACCESS</Text>
                  <Text style={[styles.matchAccessAmt, { fontFamily: runitFont.black }]}>{entryLabel}</Text>
                </View>
                <View style={styles.pricingRule} />
                <View style={[styles.pricingHalf, styles.pricingHalfPrize]}>
                  <SafeIonicons name="trophy" size={22} color={runit.gold} />
                  <Text style={styles.prizeLblCaps}>TOP PERFORMER PRIZE</Text>
                  <Text style={[styles.prizeAmtLg, { fontFamily: runitFont.black }]}>{prizeLabel}</Text>
                </View>
              </View>

              <View style={styles.sameQueueHead}>
                <SafeIonicons name="people" size={18} color={runit.gold} />
                <Text style={[styles.sameQueueTitle, { fontFamily: runitFont.black }]}>SAME QUEUE FOR BOTH PLAYERS</Text>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepBall}>
                  <Text style={[styles.stepBallTxt, { fontFamily: runitFont.black }]}>1</Text>
                </View>
                <Text style={styles.stepTxt}>
                  Your entry covers <Text style={styles.stepEm}>access</Text> when you enter the queue —{' '}
                  <Text style={styles.stepEm}>{entryLabel}</Text> from your cash wallet (charged when the match is created; both players
                  need balance).
                </Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepBall}>
                  <Text style={[styles.stepBallTxt, { fontFamily: runitFont.black }]}>2</Text>
                </View>
                <Text style={styles.stepTxt}>
                  Host and joiner both use the same action for <Text style={styles.stepEm}>{gameTitle}</Text> at this tier — same contest
                  pool. First waiting pairs with the next player who enters.
                </Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepBall}>
                  <Text style={[styles.stepBallTxt, { fontFamily: runitFont.black }]}>3</Text>
                </View>
                <Text style={styles.stepTxt}>
                  At go time you play — top score earns <Text style={styles.stepEm}>{prizeLabel}</Text> (Run It — not a player pool).
                  Losers earn Arcade Credits for the Arcade floor.
                </Text>
              </View>

              <Text style={styles.disclaimer}>
                {SKILL_CONTEST_OPERATOR_PRIZE} Arcade Credits are gameplay-only — not cash. Matchmaking may be instant while the service
                scales; pairing improves as more players queue.
              </Text>
            </View>

            <View style={[styles.actionCard, styles.actionCardH2h]}>
              <SafeIonicons name="people" size={36} color={runit.neonPurple} style={styles.actionIcon} />
              <View style={styles.actionMid}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.actionTitle, { fontFamily: runitFont.black }]}>ENTER MATCH QUEUE</Text>
                  <View style={styles.badgeH2h}>
                    <Text style={styles.badgeH2hTxt}>HEAD-TO-HEAD</Text>
                  </View>
                </View>
                <Text style={styles.actionBody}>
                  Enter this tier&apos;s pool — when two players are ready, you compete for <Text style={styles.actionEm}>{prizeLabel}</Text>
                  .
                </Text>
                <View style={styles.miniFeatRow}>
                  <MiniFeat icon="trophy" label="Compete for prize" />
                  <MiniFeat icon="people" label="Real opponents" />
                  <MiniFeat icon="flash" label="Top score wins" />
                </View>
              </View>
              <Pressable
                onPress={onHeadToHeadPrize}
                style={({ pressed }) => [styles.ctaWrap, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel="Enter match queue"
              >
                <LinearGradient
                  colors={['#7c3aed', '#4f46e5', '#6366f1']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.ctaGrad}
                >
                  <Text style={[styles.ctaTxt, { fontFamily: runitFont.black }]}>ENTER QUEUE</Text>
                  <SafeIonicons name="chevron-forward" size={18} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>

            <View style={[styles.actionCard, styles.actionCardPractice]}>
              <SafeIonicons name="school-outline" size={36} color={NEON_CYAN} style={styles.actionIcon} />
              <View style={styles.actionMid}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.actionTitle, { fontFamily: runitFont.black }]}>PRACTICE ONLY</Text>
                  <View style={styles.badgeSolo}>
                    <Text style={styles.badgeSoloTxt}>SOLO MODE</Text>
                  </View>
                </View>
                <Text style={styles.actionBody}>Free solo · no wallet · learn the game first.</Text>
                <View style={styles.miniFeatRow}>
                  <MiniFeat icon="locate-outline" label="Practice anytime" color={NEON_CYAN} />
                  <MiniFeat icon="stats-chart-outline" label="Improve your skills" color={NEON_CYAN} />
                  <MiniFeat icon="star-outline" label="No entry fee" color={NEON_CYAN} />
                </View>
              </View>
              <Pressable
                onPress={onPractice}
                style={({ pressed }) => [styles.ctaPracticeOuter, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel="Practice now"
              >
                <Text style={[styles.ctaPracticeTxt, { fontFamily: runitFont.black }]}>PRACTICE NOW</Text>
                <SafeIonicons name="chevron-forward" size={18} color={NEON_CYAN} />
              </Pressable>
            </View>

            <View style={styles.trustBar}>
              <TrustItem icon="shield-checkmark-outline" text="Fair matches. Real players. Real prizes." />
              <TrustItem icon="lock-closed-outline" text="Secure & monitored" />
              <TrustItem icon="checkmark-circle-outline" text="Top-tier protection" />
              <TrustItem icon="people-outline" text="Trusted by players" />
            </View>

            <Pressable onPress={onClose} style={styles.cancelGhost}>
              <Text style={styles.cancelGhostTxt}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030108' },
  bgPhoto: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
  },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginBottom: 14,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backPressed: { opacity: 0.8 },
  backTxt: { color: runit.gold, fontSize: 16, fontWeight: '800' },
  brandBlock: { alignItems: 'center', marginBottom: 12 },
  wordmark: { width: 220, height: 48, marginTop: 8 },
  genericBrand: { alignItems: 'center', marginBottom: 12, gap: 8 },
  genericTitle: {
    color: '#f8fafc',
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  intro: {
    color: 'rgba(203,213,225,0.95)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  introHi: { color: runit.gold, fontWeight: '800' },
  matchShell: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.55)',
    backgroundColor: runitShell.scrim82,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: runit.neonPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  lightningBg: { position: 'absolute', alignSelf: 'center', top: 72, opacity: 1, pointerEvents: 'none' },
  pricingRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 16 },
  pricingHalf: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 6 },
  pricingHalfPrize: { backgroundColor: 'rgba(30,27,75,0.35)', borderRadius: 12, paddingVertical: 8 },
  pricingRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginVertical: 4,
  },
  matchAccessLbl: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  matchAccessAmt: { color: '#f8fafc', fontSize: 22, fontVariant: ['tabular-nums'] },
  prizeLblCaps: {
    color: 'rgba(254,243,199,0.95)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  prizeAmtLg: { color: '#f8fafc', fontSize: 22, fontVariant: ['tabular-nums'] },
  sameQueueHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sameQueueTitle: { color: '#e2e8f0', fontSize: 12, letterSpacing: 0.8, flex: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepBall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: runit.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBallTxt: { color: '#0c0618', fontSize: 12 },
  stepTxt: { flex: 1, color: 'rgba(226,232,240,0.93)', fontSize: 12, lineHeight: 18 },
  stepEm: { color: '#fef08a', fontWeight: '800' },
  disclaimer: {
    marginTop: 4,
    color: 'rgba(148,163,184,0.88)',
    fontSize: 10,
    lineHeight: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: runitShell.scrim88,
  },
  actionCardH2h: {
    borderWidth: 2,
    borderColor: 'rgba(232,121,249,0.65)',
    ...runitGlowPinkSoft,
  },
  actionCardPractice: {
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.65)',
    shadowColor: NEON_CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  actionIcon: { alignSelf: 'flex-start' },
  actionMid: { flex: 1, minWidth: 140 },
  titleBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 },
  actionTitle: { color: '#fff', fontSize: 14, letterSpacing: 0.4 },
  badgeH2h: {
    backgroundColor: 'rgba(88,28,135,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.5)',
  },
  badgeH2hTxt: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  badgeSolo: {
    backgroundColor: 'rgba(8,47,73,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
  },
  badgeSoloTxt: { color: '#ecfeff', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  actionBody: { color: 'rgba(226,232,240,0.92)', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  actionEm: { color: '#fef08a', fontWeight: '800' },
  miniFeatRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  miniFeat: { flex: 1, alignItems: 'center', minWidth: 52 },
  miniFeatLbl: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(203,213,225,0.88)',
    textAlign: 'center',
    lineHeight: 11,
  },
  ctaWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.55)',
    ...runitGlowPinkSoft,
  },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 132,
  },
  ctaTxt: { color: '#fff', fontSize: 13, letterSpacing: 0.5 },
  ctaPracticeOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.7)',
    backgroundColor: 'rgba(4,12,18,0.95)',
  },
  ctaPracticeTxt: { color: NEON_CYAN, fontSize: 13, letterSpacing: 0.5 },
  trustBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.22)',
  },
  trustItem: { width: '48%', flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  trustTxt: {
    flex: 1,
    color: 'rgba(167,139,250,0.85)',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
  },
  cancelGhost: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  cancelGhostTxt: { color: 'rgba(148,163,184,0.85)', fontSize: 14, fontWeight: '700' },
});
