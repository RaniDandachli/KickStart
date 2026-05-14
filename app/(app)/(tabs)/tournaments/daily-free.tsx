import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { GuestAuthPromptModal } from '@/components/auth/GuestAuthPromptModal';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND, ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import {
  getDailyTournamentPrizeUsd,
  getDailyTournamentRounds,
  getRoundLabel,
  pickDailyGameKey,
  todayYmdLocal,
} from '@/lib/dailyFreeTournament';
import { useDailyFreeResetClock } from '@/hooks/useDailyFreeResetClock';
import { titleForH2hGameKey } from '@/lib/homeOpenMatches';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useDailyFreeTournamentStore } from '@/store/dailyFreeTournamentStore';

const WIDE_BREAK = 820;
const PURPLE = '#a855f7';
const GREEN = '#22c55e';
const GOLD = '#eab308';

const FOOT_CARDS = [
  {
    key: 'rotate',
    icon: 'sync-outline' as const,
    title: 'Rotating games',
    body: 'Tap Dash, Tile Clash, and Cyber Road — a different skill focus each round.',
  },
  {
    key: 'once',
    icon: 'calendar-outline' as const,
    title: 'One entry per day',
    body: 'One path per local calendar day — resets at midnight.',
  },
  {
    key: 'win',
    icon: 'trophy' as const,
    title: 'Winner takes the pool',
    body: 'Finish every round first — the full showcase prize goes to the bracket winner only.',
  },
  {
    key: 'notify',
    icon: 'notifications-outline' as const,
    title: 'Stay updated',
    body: 'Turn on Tournament of the Day alerts in Profile → Settings.',
  },
];

export default function DailyFreeTournamentScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAK;
  const userId = useAuthStore((s) => s.user?.id);
  const uid = userId ?? 'guest';
  const mustSignInToPlay = ENABLE_BACKEND && !userId;
  const [guestAuthOpen, setGuestAuthOpen] = useState(false);
  const hydrated = useDailyFreeTournamentStore((s) => s.hydrated);
  const nextRound = useDailyFreeTournamentStore((s) => s.nextRound);
  const eliminated = useDailyFreeTournamentStore((s) => s.eliminated);
  const loseAtRound = useDailyFreeTournamentStore((s) => s.loseAtRound);
  const hydrate = useDailyFreeTournamentStore((s) => s.hydrate);
  const resetCountdown = useDailyFreeResetClock(uid, hydrate);
  const dayKey = useDailyFreeTournamentStore((s) => s.dayKey);
  const todaysKey = dayKey || todayYmdLocal();
  const dailyRounds = getDailyTournamentRounds(todaysKey);
  const dailyPrizeUsd = getDailyTournamentPrizeUsd(todaysKey);

  useFocusEffect(
    useCallback(() => {
      void hydrate(uid);
    }, [uid, hydrate]),
  );

  const clearedToday = !eliminated && nextRound > dailyRounds;
  const canPlay = !eliminated && nextRound <= dailyRounds;
  const showSignInToPlay = mustSignInToPlay && canPlay;

  const statusLine = eliminated
    ? `Your run ended in ${getRoundLabel(Math.min(nextRound, dailyRounds))}. New bracket at midnight.`
    : clearedToday
      ? `You cleared all ${dailyRounds} rounds — the full $${dailyPrizeUsd} showcase is yours to claim per event rules. New bracket in ${resetCountdown}.`
      : canPlay
        ? `${getRoundLabel(nextRound)} · Match ${nextRound} of ${dailyRounds}`
        : 'Bracket complete';

  const currentGameTitle = useMemo(() => {
    if (!hydrated || (!canPlay && !showSignInToPlay)) return null;
    const gk = pickDailyGameKey(todaysKey, nextRound, uid);
    return titleForH2hGameKey(gk);
  }, [hydrated, canPlay, showSignInToPlay, todaysKey, nextRound, uid]);

  const primaryLabel = !hydrated
    ? 'Loading…'
    : showSignInToPlay
      ? 'Sign in to play'
      : canPlay
        ? 'Play next match'
        : clearedToday || eliminated
          ? 'Come back tomorrow'
          : 'Bracket complete';

  const primaryDisabled = !hydrated || (!canPlay && !showSignInToPlay);

  if (!ENABLE_DAILY_FREE_TOURNAMENT) {
    return (
      <Screen>
        <Text style={styles.off}>This event is not available.</Text>
        <Pressable onPress={() => router.back()} style={styles.ghostBtn}>
          <Text style={styles.ghostBtnTxt}>Back</Text>
        </Pressable>
      </Screen>
    );
  }

  function goPlay() {
    if (showSignInToPlay) {
      setGuestAuthOpen(true);
      return;
    }
    router.push('/(app)/(tabs)/tournaments/daily-free-play');
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={styles.backRow}
      >
        <SafeIonicons name="chevron-back" size={22} color={GOLD} />
        <Text style={styles.backTxt}>Events</Text>
      </Pressable>

      <View style={[wide ? styles.heroRow : styles.heroCol]}>
        <View style={styles.heroLeft}>
          <View style={styles.kickerPill}>
            <Text style={styles.kickerPillTxt}>DAILY SHOWCASE</Text>
          </View>
          <Text style={[styles.heroTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>TOURNAMENT OF THE DAY</Text>

          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <SafeIonicons name="trophy" size={16} color={GREEN} />
              <Text style={styles.statChipTxt}>
                <Text style={styles.statChipEm}>${dailyPrizeUsd}</Text> prize pool
              </Text>
            </View>
            <View style={styles.statChip}>
              <SafeIonicons name="person-outline" size={16} color={PURPLE} />
              <Text style={styles.statChipTxt}>Free entry</Text>
            </View>
            <View style={styles.statChip}>
              <SafeIonicons name="git-merge-outline" size={16} color={PURPLE} />
              <Text style={styles.statChipTxt}>{dailyRounds} rounds today</Text>
            </View>
          </View>

          <Text style={styles.body}>
            {Platform.OS === 'web'
              ? `One entry per local day (resets at midnight). Rounds rotate between Tap Dash, Tile Clash, and Cyber Road — survive all ${dailyRounds} matches to finish today’s path and compete for the $${dailyPrizeUsd} showcase. Only the bracket winner receives the prize — there are no separate 2nd or 3rd place payouts on this path.`
              : `One entry per local day (resets at midnight). Rotating skill rounds — Tap Dash, Tile Clash, and Cyber Road — survive all ${dailyRounds} rounds to finish today’s path. The full $${dailyPrizeUsd} showcase goes to the winner only — no split placements.`}
          </Text>
          <View style={styles.rulesNote}>
            <SafeIonicons name="information-circle-outline" size={16} color="rgba(148,163,184,0.9)" />
            <Text style={styles.rulesNoteTxt}>Prize details and eligibility follow the official event rules.</Text>
          </View>
        </View>

        <LinearGradient
          colors={['rgba(88,28,135,0.45)', 'rgba(15,23,42,0.95)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.prizeCard, wide && styles.prizeCardWide]}
        >
          <View style={styles.prizeIconWrap}>
            <SafeIonicons name="trophy" size={44} color={PURPLE} />
          </View>
          <Text style={styles.prizeLbl}>PRIZE POOL</Text>
          <Text style={[styles.prizeAmt, { fontFamily: runitFont.black }]}>${dailyPrizeUsd}</Text>
          <Text style={styles.prizeWinnerLine}>Winner takes all</Text>
          <Text style={styles.prizeSub}>
            The full showcase amount is awarded to whoever completes the daily path first — not divided across 1st / 2nd / 3rd.
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/tournaments/daily-free-bracket')}
            style={({ pressed }) => [styles.prizeLink, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.prizeLinkTxt}>View bracket & standings</Text>
            <SafeIonicons name="chevron-forward" size={16} color={PURPLE} />
          </Pressable>
        </LinearGradient>
      </View>

      <View style={styles.timerBar}>
        <View style={styles.timerLeft}>
          <SafeIonicons name="calendar-outline" size={20} color={GOLD} />
          <View>
            <Text style={styles.timerMain}>
              New tournament in{' '}
              <Text style={styles.timerMono}>{resetCountdown}</Text>
            </Text>
            <Text style={styles.timerSub}>Next tournament starts automatically when the timer ends.</Text>
          </View>
        </View>
      </View>

      <View style={styles.runShell}>
        <View style={[wide ? styles.runRow : styles.runCol]}>
          <View style={[styles.runColBlock, wide && styles.runThird]}>
            <Text style={styles.runSectionLbl}>{"Today's run"}</Text>
            <View style={styles.runHeadRow}>
              <View style={styles.ringOuter}>
                <Text style={[styles.ringNum, { fontFamily: runitFont.black }]}>{Math.min(nextRound, dailyRounds)}</Text>
              </View>
              <View style={styles.runHeadTxt}>
                <Text style={[styles.roundTitle, { fontFamily: runitFont.black }]}>{getRoundLabel(nextRound)}</Text>
                <Text style={styles.roundMeta}>Match {Math.min(nextRound, dailyRounds)} of {dailyRounds}</Text>
                {currentGameTitle ? (
                  <Text style={styles.playingLine}>
                    Currently playing: <Text style={styles.playingGame}>{currentGameTitle}</Text>
                  </Text>
                ) : (
                  <Text style={styles.roundMeta}>{!hydrated ? 'Loading…' : statusLine}</Text>
                )}
              </View>
            </View>
            {hydrated && currentGameTitle ? <Text style={styles.statusFine}>{statusLine}</Text> : null}
          </View>

          <View style={[styles.runColBlock, wide && styles.runThird]}>
            <Text style={styles.runSectionLbl}>Your progress</Text>
            <Text style={styles.progressHint}>
              Survive all {dailyRounds} matches to complete {"today's run"}.
            </Text>
            <View style={styles.stepper}>
              {Array.from({ length: dailyRounds }, (_, idx) => {
                const i = idx + 1;
                const done = i < nextRound || clearedToday;
                const current = (canPlay || showSignInToPlay) && !eliminated && !clearedToday && i === nextRound;
                const lostHere = eliminated && i === loseAtRound && i === nextRound;
                return (
                  <View key={i} style={styles.stepWrap}>
                    <View
                      style={[
                        styles.stepCircle,
                        done && styles.stepCircleDone,
                        current && styles.stepCircleCurrent,
                        lostHere && styles.stepCircleLost,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepNum,
                          done && styles.stepNumDone,
                          current && styles.stepNumCurrent,
                          lostHere && styles.stepNumLost,
                          { fontFamily: runitFont.black },
                        ]}
                      >
                        {lostHere ? '×' : i}
                      </Text>
                    </View>
                    {idx < dailyRounds - 1 ? <View style={[styles.stepDash, done && styles.stepDashDone]} /> : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={[styles.runColBlock, wide && styles.runThird]}>
            <View style={styles.leaderHead}>
              <SafeIonicons name="ribbon-outline" size={18} color={GOLD} />
              <Text style={styles.runSectionLbl}>Top score to beat</Text>
            </View>
            <Text style={styles.leaderPlaceholder}>—</Text>
            <Text style={styles.leaderSub}>Bracket scores update as players finish each round.</Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={goPlay}
        disabled={primaryDisabled}
        style={({ pressed }) => [
          styles.primaryCta,
          primaryDisabled && styles.primaryCtaDisabled,
          pressed && !primaryDisabled && { opacity: 0.92 },
        ]}
      >
        <LinearGradient
          colors={[runit.neonPurple, '#6d28d9']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.primaryGrad}
        >
          <SafeIonicons name="game-controller" size={22} color="#fff" />
          <Text style={[styles.primaryTxt, { fontFamily: runitFont.black }]}>{primaryLabel}</Text>
          <SafeIonicons name="chevron-forward" size={22} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(app)/(tabs)/tournaments/daily-free-bracket')}
        style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.9 }]}
      >
        <SafeIonicons name="stats-chart" size={20} color={PURPLE} />
        <Text style={[styles.secondaryTxt, { fontFamily: runitFont.black }]}>View bracket & standings</Text>
        <SafeIonicons name="chevron-forward" size={20} color={PURPLE} />
      </Pressable>

      <View style={styles.footGrid}>
        {FOOT_CARDS.map((c) => (
          <View key={c.key} style={[styles.footCard, wide && styles.footCardWide]}>
            <SafeIonicons name={c.icon} size={20} color={GREEN} style={styles.footIcon} />
            <Text style={[styles.footTitle, { fontFamily: runitFont.black }]}>{c.title}</Text>
            <Text style={styles.footBody}>{c.body}</Text>
          </View>
        ))}
      </View>

      <GuestAuthPromptModal visible={guestAuthOpen} variant="tournaments" onClose={() => setGuestAuthOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  off: { color: 'rgba(148,163,184,0.9)', marginBottom: 12 },
  ghostBtn: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16 },
  ghostBtnTxt: { color: '#e2e8f0', fontWeight: '800' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  backTxt: { color: GOLD, fontSize: 14, fontWeight: '700' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 18, marginBottom: 18 },
  heroCol: { marginBottom: 18 },
  heroLeft: { flex: 1, minWidth: 0 },
  kickerPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.45)',
    marginBottom: 10,
  },
  kickerPillTxt: { color: '#e9d5ff', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: {
    color: runit.neonPink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
    lineHeight: 28,
  },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  statChipTxt: { color: 'rgba(226,232,240,0.92)', fontSize: 12, fontWeight: '700' },
  statChipEm: { color: GREEN, fontWeight: '900' },
  body: { color: 'rgba(148,163,184,0.96)', fontSize: 13, lineHeight: 21, marginBottom: 12 },
  rulesNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  rulesNoteTxt: { flex: 1, color: 'rgba(148,163,184,0.85)', fontSize: 12, lineHeight: 17 },
  prizeCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.35)',
    marginTop: 8,
  },
  prizeCardWide: { width: 260, marginTop: 0, flexShrink: 0 },
  prizeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(88,28,135,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  prizeLbl: { color: 'rgba(148,163,184,0.9)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  prizeAmt: { color: GREEN, fontSize: 32, fontWeight: '900', marginBottom: 6 },
  prizeWinnerLine: { color: '#f8fafc', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  prizeSub: { color: 'rgba(148,163,184,0.92)', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  prizeLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  prizeLinkTxt: { color: PURPLE, fontSize: 13, fontWeight: '800' },
  timerBar: {
    backgroundColor: 'rgba(8,6,18,0.88)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.25)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  timerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerMain: { color: '#fef9c3', fontSize: 14, fontWeight: '800' },
  timerMono: {
    fontVariant: ['tabular-nums'],
    color: '#fef9c3',
    fontWeight: '800',
    ...(Platform.OS === 'web' ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } : {}),
  },
  timerSub: { color: 'rgba(148,163,184,0.88)', fontSize: 11, marginTop: 4, fontWeight: '600' },
  runShell: {
    backgroundColor: 'rgba(8,6,18,0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    padding: 16,
    marginBottom: 18,
  },
  runRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  runCol: { gap: 20 },
  runColBlock: { flex: 1, minWidth: 0 },
  runThird: { flex: 1 },
  runSectionLbl: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  runHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ringOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,179,8,0.12)',
  },
  ringNum: { color: GOLD, fontSize: 18 },
  runHeadTxt: { flex: 1, minWidth: 0 },
  roundTitle: { color: '#f8fafc', fontSize: 16, marginBottom: 4 },
  roundMeta: { color: 'rgba(148,163,184,0.92)', fontSize: 12, fontWeight: '600' },
  playingLine: { color: 'rgba(148,163,184,0.92)', fontSize: 12, marginTop: 6, fontWeight: '600' },
  playingGame: { color: GOLD, fontWeight: '900' },
  statusFine: { color: 'rgba(148,163,184,0.75)', fontSize: 11, marginTop: 8, lineHeight: 16 },
  progressHint: { color: 'rgba(148,163,184,0.85)', fontSize: 11, marginBottom: 12, lineHeight: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 8 },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(71,85,105,0.9)',
    backgroundColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    borderColor: 'rgba(234,179,8,0.85)',
    backgroundColor: 'rgba(234,179,8,0.2)',
  },
  stepCircleCurrent: {
    borderColor: PURPLE,
    backgroundColor: 'rgba(168,85,247,0.25)',
  },
  stepCircleLost: {
    borderColor: 'rgba(248,113,113,0.7)',
    backgroundColor: 'rgba(127,29,29,0.35)',
  },
  stepNum: { color: 'rgba(148,163,184,0.85)', fontSize: 11 },
  stepNumDone: { color: GOLD },
  stepNumCurrent: { color: '#f5f3ff' },
  stepNumLost: { color: '#fecaca', fontSize: 14 },
  stepDash: {
    width: 10,
    height: 2,
    backgroundColor: 'rgba(51,65,85,0.9)',
    marginHorizontal: 2,
  },
  stepDashDone: { backgroundColor: 'rgba(234,179,8,0.45)' },
  leaderHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  leaderPlaceholder: { color: 'rgba(148,163,184,0.5)', fontSize: 28, fontWeight: '800', marginBottom: 6 },
  leaderSub: { color: 'rgba(148,163,184,0.78)', fontSize: 11, lineHeight: 16 },
  primaryCta: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  primaryCtaDisabled: { opacity: 0.45 },
  primaryGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  primaryTxt: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.55)',
    backgroundColor: 'rgba(8,6,18,0.55)',
    marginBottom: 22,
  },
  secondaryTxt: { color: '#f5f3ff', fontSize: 14, fontWeight: '900' },
  footGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  footCard: {
    flexGrow: 1,
    minWidth: '46%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
  },
  footCardWide: { minWidth: '22%', maxWidth: '48%' },
  footIcon: { marginBottom: 8 },
  footTitle: { color: '#f1f5f9', fontSize: 12, marginBottom: 6, letterSpacing: 0.2 },
  footBody: { color: 'rgba(148,163,184,0.9)', fontSize: 11, lineHeight: 16 },
});
