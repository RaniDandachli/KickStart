// Neon Pocket — top-down pool (generic 8-ball style). Brand as "Neon Pocket", not third-party trademarks.
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Line, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { useAutoSubmitOnPhaseOver } from '@/lib/useAutoSubmitOnPhaseOver';
import { arcade } from '@/lib/arcadeTheme';
import { awardRedeemTicketsForPrizeRun, NEON_POOL_POINTS_PER_TICKET, ticketsFromNeonPoolScore } from '@/lib/ticketPayouts';
import { getSupabase } from '@/supabase/client';
import {
  MINIGAME_HUD_MS_MOTION,
  resetMinigameHudClock,
  shouldEmitMinigameHudFrame,
} from '@/minigames/core/minigameHudThrottle';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { GameOverExitRow, ROUTE_HOME, ROUTE_MINIGAMES } from '@/minigames/ui/GameOverExitRow';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { minigameStageMaxWidth } from '@/minigames/ui/minigameWebMaxWidth';
import { useAuthStore } from '@/store/authStore';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useProfile } from '@/hooks/useProfile';

import { NEON_POOL as P } from './neonPoolConstants';
import {
  createPoolState,
  pocketCenters,
  placeCueBall,
  shootCue,
  stepPoolPhysics,
  type PoolState,
} from './NeonPoolEngine';

const RAIL = '#2d1810';
const NEON_POOL_DIALOG_MAX = minigameStageMaxWidth(360);

function ballColor(id: number): string {
  if (id === 0) return '#f8fafc';
  if (id === 8) return '#0f172a';
  const solids = ['#fbbf24', '#3b82f6', '#dc2626', '#7c3aed', '#ea580c', '#059669', '#be123c'];
  const stripes = ['#facc15', '#60a5fa', '#f87171', '#a78bfa', '#fb923c', '#34d399', '#f472b6'];
  if (id >= 1 && id <= 7) return solids[id - 1]!;
  return stripes[id - 9] ?? '#94a3b8';
}

/** Aim + pull-back power: drag to aim, pull finger behind cue along −aim to charge, release to shoot. */
type AimSession = {
  active: boolean;
  aimUx: number;
  aimUy: number;
  aimFrozen: boolean;
  bestPull: number;
  maxForward: number;
};

function resetAimSession(cueX: number, cueY: number): AimSession {
  const rackCx = 720;
  const rackCy = P.tableH / 2;
  const vx = rackCx - cueX;
  const vy = rackCy - cueY;
  const len = Math.hypot(vx, vy) || 1;
  return {
    active: true,
    aimUx: vx / len,
    aimUy: vy / len,
    aimFrozen: false,
    bestPull: 0,
    maxForward: 0,
  };
}

export default function NeonPoolGame({ playMode = 'practice' }: { playMode?: 'practice' | 'prize' }) {
  useHidePlayTabBar();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const queryClient = useQueryClient();
  const prizeCredits = usePrizeCreditsDisplay();
  const { width: sw, height: sh } = useWindowDimensions();

  const [, setTick] = useState(0);
  const stateRef = useRef<PoolState | null>(null);
  const aimSessionRef = useRef<AimSession | null>(null);
  const startTimeRef = useRef(0);
  const [phaseUi, setPhaseUi] = useState<'ready' | 'playing' | 'over'>('ready');
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitErr, setSubmitErr] = useState(false);
  const [autoSubmitSeq, setAutoSubmitSeq] = useState(0);
  const endStatsRef = useRef({ score: 0, durationMs: 0, shots: 0 });
  const matchEndedRef = useRef(false);
  const ticketsAwardedRef = useRef(false);
  const lastHudEmitRef = useRef(0);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  const { tableW, tableH, scale } = useMemo(() => {
    const chromeH = 190;
    const shortSide = Math.min(sw, sh);
    const longSide = Math.max(sw, sh);
    const maxW = Math.min(longSide - 32, minigameStageMaxWidth(680));
    const maxH = shortSide - chromeH;
    const aspect = P.tableW / P.tableH;
    const wFromHeight = maxH * aspect;
    const tableW = Math.min(maxW, wFromHeight);
    const scale = tableW / P.tableW;
    const tableH = P.tableH * scale;
    return { tableW, tableH, scale };
  }, [sw, sh]);

  /** Landscape while focused; portrait on blur so tab shell + dimensions stay in sync when leaving. */
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, []),
  );

  const pockets = useMemo(() => pocketCenters(), []);

  const resetMatch = useCallback(() => {
    stateRef.current = createPoolState();
    aimSessionRef.current = null;
    startTimeRef.current = Date.now();
    matchEndedRef.current = false;
    resetMinigameHudClock(lastHudEmitRef);
    setPhaseUi('playing');
    setSubmitOk(false);
    setSubmitErr(false);
    bump();
  }, [bump]);

  const startGame = useCallback(() => {
    if (playMode === 'prize') {
      const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits);
      if (!ok) {
        Alert.alert('Not enough prize credits', `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits.`);
        return;
      }
    }
    resetMatch();
  }, [playMode, profileQ.data?.prize_credits, resetMatch]);

  const loop = useCallback(
    (totalDtMs: number) => {
      const s = stateRef.current;
      if (!s) return;
      if (s.phase === 'simulate') {
        runFixedPhysicsSteps(totalDtMs, (h) => {
          const cur = stateRef.current;
          if (!cur || cur.phase !== 'simulate') return false;
          stepPoolPhysics(cur, h);
          const after = stateRef.current;
          return after != null && after.phase === 'simulate';
        });
      }
      const snap = stateRef.current;
      if (!snap) return;
      let matchJustEnded = false;
      if ((snap.phase === 'won' || snap.phase === 'lost') && !matchEndedRef.current) {
        matchEndedRef.current = true;
        matchJustEnded = true;
        endStatsRef.current = {
          score: snap.score,
          durationMs: Math.max(0, Date.now() - startTimeRef.current),
          shots: snap.shots,
        };
        setPhaseUi('over');
        setAutoSubmitSeq((n) => n + 1);
      }
      if (matchJustEnded || shouldEmitMinigameHudFrame(lastHudEmitRef, MINIGAME_HUD_MS_MOTION)) {
        bump();
      }
    },
    [bump],
  );

  useRafLoop(loop, phaseUi === 'playing');

  const toTable = useCallback(
    (lx: number, ly: number) => {
      return { x: lx / scale, y: ly / scale };
    },
    [scale],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          const s = stateRef.current;
          return !!(s && (s.phase === 'aim' || s.phase === 'ballInHand'));
        },
        onPanResponderGrant: (e) => {
          const s = stateRef.current;
          if (!s) return;
          const { x, y } = toTable(e.nativeEvent.locationX, e.nativeEvent.locationY);
          if (s.phase === 'ballInHand') {
            if (placeCueBall(s, x, y)) {
              aimSessionRef.current = null;
              bump();
            }
            return;
          }
          const cue = s.balls.find((b) => b.id === 0);
          if (!cue || !cue.onTable) return;
          aimSessionRef.current = resetAimSession(cue.x, cue.y);
          bump();
        },
        onPanResponderMove: (e) => {
          const s = stateRef.current;
          const sess = aimSessionRef.current;
          if (!s || s.phase !== 'aim' || !sess?.active) return;
          const cue = s.balls.find((b) => b.id === 0);
          if (!cue) return;
          const { x, y } = toTable(e.nativeEvent.locationX, e.nativeEvent.locationY);
          const vx = x - cue.x;
          const vy = y - cue.y;
          const len = Math.hypot(vx, vy);
          if (len < 6) return;

          const proj = vx * sess.aimUx + vy * sess.aimUy;

          if (!sess.aimFrozen) {
            sess.aimUx = vx / len;
            sess.aimUy = vy / len;
            if (proj > 0) sess.maxForward = Math.max(sess.maxForward, proj);
          }

          if (proj < -5) {
            sess.aimFrozen = true;
            sess.bestPull = Math.max(sess.bestPull, -proj);
          } else if (!sess.aimFrozen && len > 14) {
            sess.aimUx = vx / len;
            sess.aimUy = vy / len;
            sess.maxForward = Math.max(sess.maxForward, Math.max(0, proj));
          }
          bump();
        },
        onPanResponderRelease: () => {
          const s = stateRef.current;
          const sess = aimSessionRef.current;
          if (!s || s.phase !== 'aim' || !sess?.active) {
            aimSessionRef.current = null;
            bump();
            return;
          }
          aimSessionRef.current = null;
          const pullPow = sess.bestPull * P.pullPowerScale;
          const fwdPow = sess.maxForward * P.forwardPowerScale;
          let power = Math.min(P.maxShotPower, Math.max(pullPow, fwdPow));
          if (power < P.minShotPower && sess.maxForward > 20) {
            power = Math.min(P.maxShotPower, sess.maxForward * P.forwardPowerScale * 1.2);
          }
          if (power < P.minShotPower) {
            bump();
            return;
          }
          shootCue(s, sess.aimUx, sess.aimUy, power);
          bump();
        },
      }),
    [bump, toTable],
  );

  const snap = stateRef.current;

  const submitScore = useCallback(async () => {
    const { score, durationMs, shots } = endStatsRef.current;
    setSubmitting(true);
    setSubmitErr(false);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        Alert.alert('Sign in required', 'Log in to submit your score.');
        setSubmitErr(true);
        return;
      }
      const prizeRun = playMode === 'prize';
      const { error } = await supabase.functions.invoke('submitMinigameScore', {
        body: {
          ...(prizeRun ? { prize_run: true as const } : {}),
          game_type: 'neon_pool',
          score,
          duration_ms: durationMs,
          taps: shots,
        },
      });
      if (error) {
        Alert.alert('Submit failed', error.message ?? 'Could not reach server.');
        setSubmitErr(true);
      } else {
        invalidateProfileEconomy(queryClient, uid);
        setSubmitOk(true);
      }
    } finally {
      setSubmitting(false);
    }
  }, [playMode, queryClient, uid]);

  useAutoSubmitOnPhaseOver({
    phase: phaseUi,
    overValue: 'over',
    runToken: autoSubmitSeq,
    onSubmit: submitScore,
  });

  const prizeTickets = playMode === 'prize' ? ticketsFromNeonPoolScore(endStatsRef.current.score) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="rgba(226,232,240,0.95)" />
          </Pressable>
          <Text style={styles.title}>Neon Pocket</Text>
          <View style={styles.creditsPill}>
            <Ionicons name="gift-outline" size={16} color="#5EEAD4" style={{ marginRight: 4 }} />
            <Text style={styles.creditsText}>{prizeCredits.toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.tagline}>
          Landscape · aim toward the rack, pull back behind the cue for power, release to shoot
        </Text>

        {phaseUi === 'ready' && (
          <View style={styles.ready}>
            <Text style={styles.readyHint}>
              {playMode === 'prize'
                ? `Prize run · ${PRIZE_RUN_ENTRY_CREDITS} credits · tickets scale with score`
                : 'Practice — free · no credits'}
            </Text>
            <AppButton title="▶  Break" onPress={startGame} />
          </View>
        )}

        {(phaseUi === 'playing' || phaseUi === 'over') && snap && (
          <>
            <View style={styles.hud}>
              <Text style={styles.hudScore}>Score {snap.score}</Text>
              <Text style={styles.hudShots}>Shots {snap.shots}</Text>
            </View>
            <Text style={styles.msg}>{snap.message}</Text>
            <View style={[styles.tableWrap, { width: tableW, height: tableH }]} {...pan.panHandlers}>
              <Svg width={tableW} height={tableH} viewBox={`0 0 ${P.tableW} ${P.tableH}`}>
                <Defs>
                  <SvgLinearGradient id="felt" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor="#065f46" />
                    <Stop offset="100%" stopColor="#022c22" />
                  </SvgLinearGradient>
                </Defs>
                <Rect x={0} y={0} width={P.tableW} height={P.tableH} fill={RAIL} rx={8} />
                <Rect
                  x={P.cushion * 0.35}
                  y={P.cushion * 0.35}
                  width={P.tableW - P.cushion * 0.7}
                  height={P.tableH - P.cushion * 0.7}
                  fill="url(#felt)"
                  rx={4}
                />
                {pockets.map((p, i) => (
                  <Circle key={i} cx={p.x} cy={p.y} r={P.pocketGrabR * 0.85} fill="#0a0a0a" />
                ))}
                {snap.balls.map((b) => {
                  if (!b.onTable) return null;
                  const fill = ballColor(b.id);
                  return (
                    <Circle key={b.id} cx={b.x} cy={b.y} r={P.ballR} fill={fill} stroke="rgba(0,0,0,0.35)" strokeWidth={1} />
                  );
                })}
                {snap.phase === 'aim' &&
                  aimSessionRef.current?.active &&
                  (() => {
                    const cue = snap.balls.find((b) => b.id === 0);
                    const sess = aimSessionRef.current;
                    if (!cue || !sess) return null;
                    const len = 220;
                    const fx = cue.x + sess.aimUx * len;
                    const fy = cue.y + sess.aimUy * len;
                    const pull = sess.bestPull;
                    const bx = cue.x - sess.aimUx * Math.min(140, pull * 0.95);
                    const by = cue.y - sess.aimUy * Math.min(140, pull * 0.95);
                    return (
                      <>
                        <Line
                          x1={cue.x}
                          y1={cue.y}
                          x2={fx}
                          y2={fy}
                          stroke="rgba(250,204,21,0.75)"
                          strokeWidth={2.5}
                          strokeDasharray="8 5"
                        />
                        {pull > 4 ? (
                          <Line
                            x1={cue.x}
                            y1={cue.y}
                            x2={bx}
                            y2={by}
                            stroke="rgba(248,113,113,0.9)"
                            strokeWidth={3}
                          />
                        ) : null}
                      </>
                    );
                  })()}
              </Svg>
            </View>
          </>
        )}

        <Modal
          visible={phaseUi === 'over'}
          transparent
          animationType="fade"
          onRequestClose={() => {
            stateRef.current = null;
            setPhaseUi('ready');
          }}
        >
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <GameOverExitRow
                onMinigames={() => router.replace(ROUTE_MINIGAMES)}
                onHome={() => router.replace(ROUTE_HOME)}
              />
              <Text style={styles.modalTitle}>
                {stateRef.current?.phase === 'won' ? 'Table cleared!' : 'Game over'}
              </Text>
              <Text style={styles.modalScore}>Score: {endStatsRef.current.score}</Text>
              {playMode === 'prize' && (
                <Text style={styles.modalTickets}>+{prizeTickets} redeem tickets</Text>
              )}
              <AppButton
                title="Play again"
                onPress={() => {
                  startGame();
                }}
              />
              {playMode === 'prize' ? (
                <>
                  {submitting ? (
                    <>
                      <Text style={[styles.practiceNote, { marginTop: 10 }]}>Saving score…</Text>
                      <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
                    </>
                  ) : null}
                  {submitOk ? <Text style={[styles.practiceNote, { marginTop: 10 }]}>Score saved.</Text> : null}
                  {submitErr && !submitting ? (
                    <>
                      <Text style={[styles.practiceNote, { marginTop: 10 }]}>Could not save score.</Text>
                      <AppButton
                        className="mt-2"
                        title="Retry"
                        variant="secondary"
                        onPress={() => {
                          setSubmitErr(false);
                          void submitScore();
                        }}
                      />
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {submitting ? (
                    <>
                      <Text style={[styles.practiceNote, { marginTop: 10 }]}>Saving practice run…</Text>
                      <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
                    </>
                  ) : null}
                  {submitOk ? (
                    <Text style={[styles.practiceNote, { marginTop: 10 }]}>
                      Practice run saved (no prize tickets).
                    </Text>
                  ) : null}
                  {submitErr && !submitting ? (
                    <>
                      <Text style={[styles.practiceNote, { marginTop: 10 }]}>Could not save run.</Text>
                      <AppButton
                        className="mt-2"
                        title="Retry"
                        variant="secondary"
                        onPress={() => {
                          setSubmitErr(false);
                          void submitScore();
                        }}
                      />
                    </>
                  ) : null}
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  root: { flex: 1, paddingHorizontal: 12 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#5eead4',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.35)',
  },
  creditsText: { color: 'rgba(226,232,240,0.95)', fontSize: 13, fontWeight: '700' },
  tagline: { textAlign: 'center', color: 'rgba(148,163,184,0.9)', fontSize: 12, marginBottom: 8 },
  ready: { alignItems: 'center', gap: 16, marginTop: 24 },
  readyHint: { color: '#fde047', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  hud: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  hudScore: { color: '#f8fafc', fontWeight: '900', fontSize: 16 },
  hudShots: { color: '#94a3b8', fontWeight: '700', fontSize: 14 },
  msg: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginBottom: 8, textAlign: 'center' },
  tableWrap: { alignSelf: 'center', borderRadius: 10, overflow: 'hidden' },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: NEON_POOL_DIALOG_MAX,
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.35)',
    backgroundColor: 'rgba(15,23,42,0.98)',
    gap: 10,
  },
  modalTitle: { color: '#5eead4', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  modalScore: { color: '#f8fafc', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  modalTickets: { color: '#fde047', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  practiceNote: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
});
