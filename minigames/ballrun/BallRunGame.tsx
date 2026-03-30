import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { awardRedeemTicketsForPrizeRun, BALL_RUN_POINTS_PER_TICKET, ticketsFromBallRunScore } from '@/lib/ticketPayouts';
import { arcade } from '@/lib/arcadeTheme';
import {
  createBallRunState,
  displayScore,
  getRunSeed,
  jump,
  laneLeft,
  laneRight,
  type BallRunState,
} from '@/minigames/ballrun/BallRunEngine';
import { BallRunScene3D } from '@/minigames/ballrun/BallRunScene3D';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';
import { getSupabase } from '@/supabase/client';

const HIGH_KEY = 'ball_run_high_v2';

type Phase = 'ready' | 'playing' | 'paused' | 'over';

function modeLabel(tier: number): string {
  if (tier >= 9) return 'HYPER';
  if (tier >= 5) return 'FAST';
  return 'MEDIUM';
}

type Props = { playMode: 'practice' | 'prize'; /** Deterministic course for 1v1 / replays */ runSeed?: number };

export default function BallRunGame({ playMode, runSeed }: Props) {
  useHidePlayTabBar();
  const router = useRouter();
  const profileQ = useProfile(useAuthStore((s) => s.user?.id));

  const [phase, setPhase] = useState<Phase>('ready');
  const [uiTick, setUiTick] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [paused, setPaused] = useState(false);
  const bump = useCallback(() => setUiTick((t) => t + 1), []);
  const modelRef = useRef<BallRunState>(createBallRunState(runSeed));
  const startTimeRef = useRef(0);
  const endStatsRef = useRef({ score: 0, durationMs: 0, taps: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(HIGH_KEY).then((raw) => {
      const n = raw ? parseInt(raw, 10) : 0;
      if (Number.isFinite(n) && n > 0) setHighScore(n);
    });
  }, []);

  const resetRun = useCallback(() => {
    modelRef.current = createBallRunState(runSeed);
    setSubmitOk(false);
    setPhase('ready');
    bump();
  }, [bump, runSeed]);

  const endGame = useCallback(() => {
    const m = modelRef.current;
    const durationMs = Math.max(0, Date.now() - startTimeRef.current);
    endStatsRef.current = {
      score: displayScore(m),
      durationMs,
      taps: m.inputEvents,
    };
    const ds = displayScore(m);
    void AsyncStorage.getItem(HIGH_KEY).then((raw) => {
      const prev = raw ? parseInt(raw, 10) : 0;
      const best = Math.max(Number.isFinite(prev) ? prev : 0, ds);
      setHighScore(best);
      void AsyncStorage.setItem(HIGH_KEY, String(best));
    });
    if (playMode === 'prize') {
      awardRedeemTicketsForPrizeRun(ticketsFromBallRunScore(ds));
    }
    setPhase('over');
    bump();
  }, [bump, playMode]);

  const onStart = useCallback(() => {
    if (phase !== 'ready') return;
    if (playMode === 'prize') {
      const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits);
      if (!ok) {
        Alert.alert(
          'Not enough prize credits',
          `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
        );
        return;
      }
    }
    modelRef.current = createBallRunState(runSeed);
    startTimeRef.current = Date.now();
    setSubmitOk(false);
    setPhase('playing');
    bump();
  }, [phase, playMode, profileQ.data?.prize_credits, bump, runSeed]);

  const goLeft = useCallback(() => {
    if (phase !== 'playing' || paused) return;
    laneLeft(modelRef.current);
    bump();
  }, [phase, paused, bump]);

  const goRight = useCallback(() => {
    if (phase !== 'playing' || paused) return;
    laneRight(modelRef.current);
    bump();
  }, [phase, paused, bump]);

  const swipeActionsRef = useRef({
    goLeft,
    goRight,
    doJump: () => jump(modelRef.current, 0),
  });
  swipeActionsRef.current = { goLeft, goRight, doJump: () => jump(modelRef.current, 0) };

  const swipeGateRef = useRef({ playing: false, paused: false });
  swipeGateRef.current = { playing: phase === 'playing', paused };

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          swipeGateRef.current.playing && !swipeGateRef.current.paused,
        onMoveShouldSetPanResponder: (_, g) =>
          swipeGateRef.current.playing &&
          !swipeGateRef.current.paused &&
          (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10),
        onPanResponderRelease: (_, g) => {
          if (!swipeGateRef.current.playing || swipeGateRef.current.paused) return;
          const { dx, dy } = g;
          const a = swipeActionsRef.current;
          const SW = 42;
          const TAP = 14;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < TAP * TAP) {
            a.doJump();
            bump();
            return;
          }
          if (Math.abs(dx) >= Math.abs(dy)) {
            if (Math.abs(dx) < SW) return;
            if (dx > 0) {
              a.goRight();
            } else {
              a.goLeft();
            }
          } else if (dy < -SW) {
            a.doJump();
          } else {
            return;
          }
          bump();
        },
      }),
    [bump],
  );

  const submitScore = useCallback(async () => {
    const { score, durationMs, taps } = endStatsRef.current;
    setSubmitting(true);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        Alert.alert('Sign in required', 'Log in to submit your score.');
        return;
      }
      const { error } = await supabase.functions.invoke('submitMinigameScore', {
        body: {
          game_type: 'ball_run' as const,
          score,
          duration_ms: durationMs,
          taps,
        },
      });
      if (error) {
        Alert.alert('Submit failed', error.message ?? 'Could not reach server.');
        return;
      }
      setSubmitOk(true);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const m = modelRef.current;
  void uiTick;
  const cur = displayScore(m);
  const tier = Math.min(14, Math.floor(m.timeMs / 11_000));
  const showScore = phase === 'playing' || phase === 'paused' ? cur : phase === 'ready' ? 0 : endStatsRef.current.score;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0A' }]} />

        <View style={styles.topHud} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.roundBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#22d3ee" />
          </Pressable>

          <View style={styles.pillsRow}>
            <View
              style={styles.pill}
              accessibilityLabel={`Current score ${showScore} ${modeLabel(tier)} mode`}
            >
              <Text style={styles.pillLabel}>{modeLabel(tier)} MODE</Text>
              <Text style={styles.pillVal}>{showScore}</Text>
            </View>
            <View style={styles.pillHi} accessibilityLabel={`All time high score ${highScore}`}>
              <View style={styles.crownRow}>
                <Ionicons name="trophy" size={12} color="#34d399" />
                <Text style={styles.pillLabelHi}>ALL TIME</Text>
              </View>
              <Text style={styles.pillValHi}>{highScore}</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={paused ? 'Resume' : 'Pause'}
            onPress={() => {
              if (phase !== 'playing' && phase !== 'paused') return;
              setPaused((p) => !p);
            }}
            style={styles.roundBtn}
            disabled={phase !== 'playing' && phase !== 'paused'}
          >
            <Ionicons name={paused ? 'play' : 'pause'} size={20} color="#22d3ee" />
          </Pressable>
        </View>

        <View style={styles.stage}>
          <BallRunScene3D
            modelRef={modelRef}
            phase={phase}
            paused={paused}
            onDead={endGame}
            bump={bump}
            tick={uiTick}
          />

          {phase === 'ready' ? (
            <Pressable style={StyleSheet.absoluteFill} onPress={onStart}>
              <View style={styles.intro} pointerEvents="none">
                <Text style={styles.introTitle}>NEON BALL RUN</Text>
                <Text style={styles.introSub}>
                  {playMode === 'prize'
                    ? `Prize run · ${PRIZE_RUN_ENTRY_CREDITS} credits · +1 ticket / ${BALL_RUN_POINTS_PER_TICKET} pts`
                    : 'Practice · free'}
                </Text>
                <Text style={styles.introBody}>Jump over hurdles · dodge walls · lanes L/R</Text>
                <Text style={styles.introCta}>Tap to start</Text>
                <Text style={styles.seedHint}>Seed {getRunSeed(m)}</Text>
              </View>
            </Pressable>
          ) : null}

          {phase === 'playing' && !paused ? (
            <View
              style={styles.swipeLayer}
              accessibilityLabel="Ball run controls: swipe to move and jump"
              {...swipeResponder.panHandlers}
            />
          ) : null}
        </View>

        {phase === 'over' ? (
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.goTitle}>Game over</Text>
              <Text style={styles.goScore}>Score {endStatsRef.current.score}</Text>
              {playMode === 'prize' ? (
                <Text style={styles.goTickets}>
                  +{ticketsFromBallRunScore(endStatsRef.current.score)} redeem tickets
                </Text>
              ) : null}
              <AppButton title="Play again" onPress={resetRun} className="mb-3" />
              <AppButton title="Exit" variant="ghost" onPress={() => router.back()} className="mb-3" />
              {playMode === 'prize' ? (
                <>
                  <AppButton
                    title={submitOk ? 'Score submitted' : 'Submit score'}
                    variant="secondary"
                    loading={submitting}
                    disabled={submitOk || submitting}
                    onPress={submitScore}
                  />
                  {submitting ? <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} /> : null}
                </>
              ) : (
                <Text style={styles.practiceNote}>Practice — not on leaderboards.</Text>
              )}
            </View>
          </View>
        ) : null}

        <Modal visible={paused} transparent animationType="fade">
          <View style={styles.pauseBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused(false)} accessibilityLabel="Resume" />
            <View style={styles.pauseCard}>
              <Text style={styles.pauseTitle}>Paused</Text>
              <AppButton title="Resume" onPress={() => setPaused(false)} />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0A' },
  root: { flex: 1 },
  topHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 8,
    zIndex: 40,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(248,250,252,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 96,
    alignItems: 'center',
  },
  pillLabel: { color: 'rgba(248,250,252,0.92)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  pillVal: { color: '#fff', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pillHi: {
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 96,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
  },
  crownRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillLabelHi: { color: '#34d399', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  pillValHi: { color: '#34d399', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  stage: { flex: 1, position: 'relative' },
  intro: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,10,0.78)',
    padding: 20,
    zIndex: 40,
  },
  introTitle: {
    color: '#22d3ee',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  introSub: { color: 'rgba(203,213,225,0.9)', fontSize: 12, textAlign: 'center', marginBottom: 6 },
  introBody: { color: 'rgba(148,163,184,0.95)', fontSize: 13, marginBottom: 16 },
  introCta: { color: '#34d399', fontSize: 17, fontWeight: '900' },
  seedHint: { marginTop: 14, color: 'rgba(100,116,139,0.85)', fontSize: 10, fontVariant: ['tabular-nums'] },
  swipeLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
  },
  goTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  goScore: { color: '#e2e8f0', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  goTickets: { color: '#5eead4', fontSize: 14, marginBottom: 12 },
  practiceNote: { color: 'rgba(148,163,184,0.9)', fontSize: 13, marginTop: 8, textAlign: 'center' },
  pauseBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.98)',
    minWidth: 240,
    alignItems: 'center',
    gap: 12,
  },
  pauseTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
});
