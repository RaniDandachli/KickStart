import type { ComponentProps } from 'react';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { TapDashLogo } from '@/components/arcade/TapDashLogo';
import type { ArcadePlayLauncherRoute } from '@/lib/arcadePlayLauncherRoutes';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { runit, runitFont, runitGlowPinkSoft, runitShell } from '@/lib/runitArcadeTheme';

const NEON_CYAN = '#22d3ee';

type ModalProps = {
  visible: boolean;
  gameTitle: string;
  /** Tap Dash (and future) — arcade cabinet background + wordmark when `tap-dash`. */
  gameRoute?: ArcadePlayLauncherRoute;
  onClose: () => void;
  onPractice: () => void;
  onPrizeRun: () => void;
  /** Opens Shop → Arcade credits (packs). */
  onBuyCredits?: () => void;
  /** Defaults to standard arcade entry (10). Turbo Arena uses 20. */
  prizeEntryCredits?: number;
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

export function ArcadePlayModeModal({
  visible,
  gameTitle,
  gameRoute,
  onClose,
  onPractice,
  onPrizeRun,
  onBuyCredits,
  prizeEntryCredits = PRIZE_RUN_ENTRY_CREDITS,
}: ModalProps) {
  const tapDash = gameRoute === 'tap-dash';

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
          colors={['transparent', 'rgba(168,85,247,0.05)', 'transparent']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 0.45 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.8 }]} hitSlop={12}>
              <SafeIonicons name="chevron-back" size={22} color={runit.gold} />
              <Text style={styles.backTxt}>Back</Text>
            </Pressable>

            <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>HOW DO YOU WANT TO PLAY?</Text>

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
              <Text style={[styles.gameTitle, { fontFamily: runitFont.black }]} numberOfLines={2}>
                {gameTitle}
              </Text>
            )}

            <Text style={styles.intro}>
              Arcade runs use <Text style={styles.introHi}>Arcade Credits</Text> and <Text style={styles.introHi}>prize credits</Text>.
              Practice is always free — prize runs cost credits to start and award more on a strong score.
            </Text>

            <View style={styles.creditShell}>
              <SafeIonicons name="diamond-outline" size={28} color={runit.gold} />
              <View style={styles.creditMid}>
                <Text style={styles.creditLbl}>PRIZE RUN ENTRY</Text>
                <Text style={[styles.creditAmt, { fontFamily: runitFont.black }]}>{prizeEntryCredits} credits</Text>
                <Text style={styles.creditSub}>Spend prize credits · win more · redeem tickets for rewards</Text>
              </View>
            </View>

            <View style={[styles.actionCard, styles.actionCardPractice]}>
              <SafeIonicons name="school-outline" size={36} color={NEON_CYAN} style={styles.actionIcon} />
              <View style={styles.actionMid}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.actionTitle, { fontFamily: runitFont.black }]}>PRACTICE RUN</Text>
                  <View style={styles.badgeSolo}>
                    <Text style={styles.badgeSoloTxt}>SOLO MODE</Text>
                  </View>
                </View>
                <Text style={styles.actionBody}>Free · no prize credits spent — learn patterns and improve your score.</Text>
                <View style={styles.miniFeatRow}>
                  <MiniFeat icon="locate-outline" label="Practice anytime" color={NEON_CYAN} />
                  <MiniFeat icon="stats-chart-outline" label="Build skill" color={NEON_CYAN} />
                  <MiniFeat icon="star-outline" label="No credits" color={NEON_CYAN} />
                </View>
              </View>
              <Pressable
                onPress={onPractice}
                style={({ pressed }) => [styles.ctaPracticeOuter, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel="Start practice run"
              >
                <Text style={[styles.ctaPracticeTxt, { fontFamily: runitFont.black }]}>PRACTICE NOW</Text>
                <SafeIonicons name="chevron-forward" size={18} color={NEON_CYAN} />
              </Pressable>
            </View>

            <View style={[styles.actionCard, styles.actionCardPrize]}>
              <SafeIonicons name="diamond-outline" size={36} color={runit.neonPurple} style={styles.actionIcon} />
              <View style={styles.actionMid}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.actionTitle, { fontFamily: runitFont.black }]}>PLAY FOR PRIZES</Text>
                  <View style={styles.badgeH2h}>
                    <Text style={styles.badgeH2hTxt}>PRIZE RUN</Text>
                  </View>
                </View>
                <Text style={styles.actionBody}>
                  Costs {prizeEntryCredits} prize credits to start · skill contest for more credits — use tickets in Prizes for physical
                  rewards.
                </Text>
                <View style={styles.miniFeatRow}>
                  <MiniFeat icon="trophy" label="Win credits" />
                  <MiniFeat icon="ribbon-outline" label="Skill contest" />
                  <MiniFeat icon="gift-outline" label="Redeem prizes" />
                </View>
              </View>
              <Pressable
                onPress={onPrizeRun}
                style={({ pressed }) => [styles.ctaWrap, pressed && { opacity: 0.92 }]}
                accessibilityRole="button"
                accessibilityLabel="Play for prizes"
              >
                <LinearGradient
                  colors={['#7c3aed', '#4f46e5', '#6366f1']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.ctaGrad}
                >
                  <Text style={[styles.ctaTxt, { fontFamily: runitFont.black }]}>PLAY FOR PRIZES</Text>
                  <SafeIonicons name="chevron-forward" size={18} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>

            {onBuyCredits ? (
              <Pressable
                onPress={onBuyCredits}
                style={({ pressed }) => [styles.buyRow, pressed && { opacity: 0.88 }]}
                accessibilityRole="button"
                accessibilityLabel="Buy arcade credits"
              >
                <SafeIonicons name="cart-outline" size={18} color={runit.neonPink} />
                <Text style={styles.buyRowText}>Buy arcade credits</Text>
              </Pressable>
            ) : null}

            <View style={styles.trustBar}>
              <TrustItem icon="shield-checkmark-outline" text="Fair runs. Built for repeat play." />
              <TrustItem icon="lock-closed-outline" text="Secure & monitored" />
              <TrustItem icon="checkmark-circle-outline" text="Credits stay in your account" />
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
  bgPhoto: { ...StyleSheet.absoluteFillObject, opacity: 0.4 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 28 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginBottom: 12,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backTxt: { color: runit.gold, fontSize: 16, fontWeight: '800' },
  kicker: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  brandBlock: { alignItems: 'center', marginBottom: 10 },
  wordmark: { width: 200, height: 44, marginTop: 6 },
  gameTitle: {
    color: '#f8fafc',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  intro: {
    color: 'rgba(203,213,225,0.95)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 14,
  },
  introHi: { color: runit.gold, fontWeight: '800' },
  creditShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.5)',
    backgroundColor: runitShell.scrim85,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  creditMid: { flex: 1, minWidth: 0 },
  creditLbl: { color: 'rgba(148,163,184,0.95)', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  creditAmt: { color: '#f8fafc', fontSize: 22, fontVariant: ['tabular-nums'], marginBottom: 4 },
  creditSub: { color: 'rgba(148,163,184,0.88)', fontSize: 10, lineHeight: 14 },
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
  actionCardPractice: {
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.65)',
    shadowColor: NEON_CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  actionCardPrize: {
    borderWidth: 2,
    borderColor: 'rgba(232,121,249,0.65)',
    ...runitGlowPinkSoft,
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
    paddingHorizontal: 14,
    minWidth: 128,
  },
  ctaTxt: { color: '#fff', fontSize: 12, letterSpacing: 0.4 },
  ctaPracticeOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.7)',
    backgroundColor: 'rgba(4,12,18,0.95)',
  },
  ctaPracticeTxt: { color: NEON_CYAN, fontSize: 12, letterSpacing: 0.4 },
  buyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
    paddingVertical: 10,
  },
  buyRowText: { color: runit.neonPink, fontSize: 14, fontWeight: '800' },
  trustBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
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
