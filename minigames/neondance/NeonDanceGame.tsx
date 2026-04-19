import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { AppButton } from '@/components/ui/AppButton';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { useProfile } from '@/hooks/useProfile';
import { beginMinigamePrizeRun } from '@/lib/beginMinigamePrizeRun';
import { assertBackendPrizeSignedIn, assertPrizeRunReservation } from '@/lib/prizeRunGuards';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { alertInsufficientPrizeCredits } from '@/lib/arcadeCreditsShop';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';
import { awardRedeemTicketsForPrizeRun, ticketsFromNeonDanceScore } from '@/lib/ticketPayouts';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { GameOverExitRow, ROUTE_HOME, ROUTE_MINIGAMES } from '@/minigames/ui/GameOverExitRow';
import { minigameImmersiveStageWidth } from '@/minigames/ui/minigameWebMaxWidth';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { useLockNavigatorGesturesWhile } from '@/minigames/ui/useLockNavigatorGesturesWhile';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { useAuthStore } from '@/store/authStore';
import { getSupabase } from '@/supabase/client';
import type { H2hSkillContestBundle } from '@/types/match';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BGM_ASSET = require('@/assets/sounds/dash-duel-neon-velocity.mp3');

const STORAGE_BEST = '@kickclash/neon_dance_best_v2';

/**
 * Advance units / sec toward the player — constant for the whole run.
 * Difficulty comes from more hoop colors + ball color swaps only, not faster approach.
 */
const FORWARD_FIXED = 0.12;
/**
 * Pass/fail when the hoop crosses this advance (slightly past 1.0 so the ring has visually
 * “arrived” at the player plane — matches `approachScale` feel and avoids felt-early deaths).
 */
const HOOP_COLLISION_PLANE = 1.012;
/** Minimum / maximum spacing in advance space when queueing the next hoop. */
const HOOP_QUEUE_GAP_MIN = 0.45;
const HOOP_QUEUE_GAP_MAX = 2.45;
/**
 * Target minimum real time (seconds) for a hoop to travel spawn → player at the fixed forward rate.
 * Gap scales with that rate so hoops stay spaced; forward itself never ramps.
 */
const HOOP_ARRIVAL_MIN_SEC = 0.52;

/** Hoop spawns at advance = -gap and crosses the player at advance = 1 → travel distance (1+gap) in advance units. */
function queueGapForForward(forward: number): number {
  const f = Math.max(1e-4, forward);
  const g = f * HOOP_ARRIVAL_MIN_SEC - 1;
  return Math.min(HOOP_QUEUE_GAP_MAX, Math.max(HOOP_QUEUE_GAP_MIN, g));
}
const SWIPE_BAR_HEIGHT = 84;

/** Cap FX so long runs stay smooth */
const MAX_PARTICLES = 20;
const PASS_PARTICLE_COUNT = 6;
const TRAIL_MAX = 8;
const TUNNEL_RING_COUNT = 3;
/**
 * Throttle React re-renders to N animation frames (not physics steps — avoids multiple
 * setState in one rAF when catch-up runs several fixed steps). Keep low so hoop spin looks smooth.
 */
const RENDER_FRAME_STRIDE = 2;

/** Run It Arcade / match resolution payload (client-side; optional fields also sent to submitMinigameScore). */
export type NeonDanceRunPayload = {
  score: number;
  ringsPassed: number;
  survivalTime: number;
  bestStreak: number;
  progression: number;
  winnerReady: true;
};

const PALETTE = ['#ff2d92', '#22d3ee', '#c084fc', '#bef264', '#fb923c', '#3b82f6'];

function normAngle(a: number): number {
  let x = a % (Math.PI * 2);
  if (x < 0) x += Math.PI * 2;
  return x;
}

/** Shortest signed delta from a to b (radians). */
function shortestDelta(a: number, b: number): number {
  const da = normAngle(a);
  const db = normAngle(b);
  let d = db - da;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Which sector index (0..n-1) sits at world angle `worldAngle` on a ring rotated by `rotation`. */
function sectorAtWorldAngle(worldAngle: number, rotation: number, n: number): number {
  if (n <= 0) return 0;
  const local = normAngle(worldAngle - rotation);
  const idx = Math.floor(local / ((Math.PI * 2) / n));
  return Math.min(n - 1, Math.max(0, idx));
}

function describeSector(
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  a0: number,
  a1: number,
): string {
  const x0o = cx + rOut * Math.cos(a0);
  const y0o = cy + rOut * Math.sin(a0);
  const x1o = cx + rOut * Math.cos(a1);
  const y1o = cy + rOut * Math.sin(a1);
  const x0i = cx + rIn * Math.cos(a0);
  const y0i = cy + rIn * Math.sin(a0);
  const x1i = cx + rIn * Math.cos(a1);
  const y1i = cy + rIn * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${x0i} ${y0i}`,
    `L ${x0o} ${y0o}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i}`,
    'Z',
  ].join(' ');
}

/** Map approach 0→1 to visual scale (hoop grows from tunnel depth toward you). */
function approachScale(p: number): number {
  const t = Math.max(0, Math.min(1, (p + 0.12) / 1.12));
  return 0.2 + 0.8 * (t * t * (3 - 2 * t));
}

type Hoop = {
  id: number;
  /** 0 = far (small), 1 = at player plane (full size). */
  advance: number;
  rot: number;
  omega: number;
  n: number;
};

type Particle = { id: number; x: number; y: number; vx: number; vy: number; life: number; color: string };

/** Static depth rings — memoized so parent `tick` re-renders don’t rebuild this SVG subtree. */
const NeonDanceTunnelRings = memo(function NeonDanceTunnelRings({
  winW,
  playAreaH,
  stageCenterX,
  stageCenterY,
}: {
  winW: number;
  playAreaH: number;
  stageCenterX: number;
  stageCenterY: number;
}) {
  const dim = Math.min(winW, playAreaH);
  return (
    <Svg
      style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
      width={winW}
      height={playAreaH}
      pointerEvents="none"
    >
      {Array.from({ length: TUNNEL_RING_COUNT }, (_, i) => {
        const r = 28 + i * dim * 0.13;
        const o = 0.06 + i * 0.045;
        return (
          <Circle
            key={`tun-${i}`}
            cx={stageCenterX}
            cy={stageCenterY}
            r={r}
            stroke="rgba(148,163,184,0.35)"
            strokeWidth={1.5}
            fill="none"
            opacity={o}
          />
        );
      })}
    </Svg>
  );
});

export default function NeonDanceGame({
  playMode = 'practice',
  h2hSkillContest,
}: {
  playMode?: 'practice' | 'prize';
  h2hSkillContest?: H2hSkillContestBundle;
}) {
  useHidePlayTabBar();
  const router = useRouter();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const { width: winW, height: winH } = useWindowDimensions();
  const stageW = minigameImmersiveStageWidth(winW);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'dying' | 'over'>(() =>
    h2hSkillContest ? 'playing' : 'ready',
  );
  useLockNavigatorGesturesWhile(
    phase === 'playing' || phase === 'paused' || phase === 'dying',
  );
  const [score, setScore] = useState(0);
  const [tick, setTick] = useState(0);
  const [hud, setHud] = useState({
    ringsPassed: 0,
    streak: 0,
    sectors: 2,
    ballIdx: 0,
    pulseBg: 0,
  });
  const [ticketsEarned, setTicketsEarned] = useState(0);
  const [bestLocal, setBestLocal] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);

  const mode = h2hSkillContest ? 'h2h' : playMode === 'prize' ? 'prize' : 'practice';
  const appliedRoute = useRef(false);
  const prizeRunReservationRef = useRef<string | null>(null);
  const routePrizeAutoStartedRef = useRef(false);
  /** Prize run started from the ready screen without `?mode=prize` (charges + tickets still apply). */
  const manualPrizeRunRef = useRef(false);

  const hoopsRef = useRef<Hoop[]>([]);
  const nextHoopIdRef = useRef(1);
  const ballAngleRef = useRef(Math.PI / 2);
  const targetAngleRef = useRef(Math.PI / 2);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const nextParticleIdRef = useRef(1);
  const timeMsRef = useRef(0);
  const inputSamplesRef = useRef(0);
  const scoreRef = useRef(0);
  const ringsPassedRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const sectorsRef = useRef(2);
  const ballIdxRef = useRef(0);
  const progressionRef = useRef(0);
  /** Last approach speed — used when queueing hoops (spacing matches fixed forward speed). */
  const forwardQueueRef = useRef(FORWARD_FIXED);
  const bgPulseRef = useRef(0);
  const passBurstRef = useRef(0);
  const lastRunRef = useRef({
    score: 0,
    durationMs: 0,
    taps: 0,
    ringsPassed: 0,
    bestStreak: 0,
    progression: 0,
  });

  const failFlash = useRef(new Animated.Value(0)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const gameOverLockRef = useRef(false);
  /** Counts rAF frames; paired with RENDER_FRAME_STRIDE so we never fire multiple setTick in one frame. */
  const visualFrameAccRef = useRef(0);
  const forcedThreeColorRef = useRef(false);
  const lastColorSwitchMsRef = useRef(0);
  const insets = useSafeAreaInsets();

  const playAreaH = Math.max(360, winH - 220 - SWIPE_BAR_HEIGHT - Math.min(32, insets.bottom));
  const ringBase = Math.min(stageW - 24, 320);
  const BALL_R = Math.max(12, ringBase * 0.048);
  const stageCenterX = winW / 2;
  const stageCenterY = playAreaH / 2;

  const resetRoundColors = useCallback((n: number) => {
    sectorsRef.current = n;
    const b = (Math.random() * n) | 0;
    ballIdxRef.current = b;
    /** Hoops snapshot `n` at spawn — without this, rings stay 2-color while the ball can be 3+ (impossible align / wrong fail). */
    for (const h of hoopsRef.current) {
      h.n = n;
    }
    setHud((h) => ({ ...h, sectors: n, ballIdx: b }));
  }, []);

  const pushHoop = useCallback((advance: number) => {
    const n = sectorsRef.current;
    /** Spin (rad/s) — same statistical range for every hoop; harder tiers add segments, not faster spin. */
    const omega =
      (Math.sign(Math.random() - 0.5) || 1) * (1.28 + Math.random() * 0.48);
    hoopsRef.current.push({
      id: nextHoopIdRef.current++,
      advance,
      rot: Math.random() * Math.PI * 2,
      omega,
      n,
    });
  }, []);

  const ensureHoops = useCallback(() => {
    const list = hoopsRef.current;
    if (list.length === 0) {
      pushHoop(0.58);
      pushHoop(0.1);
      pushHoop(-0.42);
      return;
    }
    /** Walk backward from the furthest hoop; each new spawn must sit at its own depth (bug was reusing one minAdv → stacked rings + mismatched omegas = twitch). */
    let minAdv = Math.min(...list.map((h) => h.advance));
    let guard = 0;
    while (minAdv < -0.08 && guard++ < 10) {
      const gap = queueGapForForward(forwardQueueRef.current);
      minAdv -= gap;
      pushHoop(minAdv);
    }
  }, [pushHoop]);

  const resetGame = useCallback(() => {
    gameOverLockRef.current = false;
    visualFrameAccRef.current = 0;
    forcedThreeColorRef.current = false;
    lastColorSwitchMsRef.current = 0;
    hoopsRef.current = [];
    nextHoopIdRef.current = 1;
    timeMsRef.current = 0;
    inputSamplesRef.current = 0;
    scoreRef.current = 0;
    ringsPassedRef.current = 0;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    progressionRef.current = 0;
    forwardQueueRef.current = FORWARD_FIXED;
    ballAngleRef.current = Math.PI / 2;
    targetAngleRef.current = Math.PI / 2;
    trailRef.current = [];
    particlesRef.current = [];
    bgPulseRef.current = 0;
    passBurstRef.current = 0;
    sectorsRef.current = 2;
    const b = (Math.random() * 2) | 0;
    ballIdxRef.current = b;
    setScore(0);
    setHud({ ringsPassed: 0, streak: 0, sectors: 2, ballIdx: b, pulseBg: 0 });
    ensureHoops();
  }, [ensureHoops]);

  useEffect(() => {
    void (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_BEST);
        if (v != null) setBestLocal(Math.max(0, parseInt(v, 10) || 0));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const persistBest = useCallback((v: number) => {
    void (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_BEST, String(v));
        setBestLocal(v);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const buildH2hBody = useCallback(() => {
    const r = lastRunRef.current;
    return {
      game_type: 'neon_dance' as const,
      score: r.score,
      duration_ms: r.durationMs,
      taps: r.taps,
      rings_passed: r.ringsPassed,
      best_streak: r.bestStreak,
      progression: r.progression,
      survival_time_sec: r.durationMs / 1000,
      winner_ready: true,
      match_session_id: h2hSkillContest!.matchSessionId,
    };
  }, [h2hSkillContest]);

  const { h2hSubmitPhase, h2hPoll, setH2hRetryKey } = useH2hSkillContestSubmitAndPoll(
    h2hSkillContest,
    phase,
    buildH2hBody,
    'over',
  );

  const chargePrizeRunIfNeeded = useCallback(async (): Promise<boolean> => {
    if (ENABLE_BACKEND) {
      if (!assertBackendPrizeSignedIn(ENABLE_BACKEND, uid)) return false;
      const r = await beginMinigamePrizeRun('neon_dance');
      if (!r.ok) {
        if (r.error === 'insufficient_credits') {
          alertInsufficientPrizeCredits(
            router,
            `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
          );
        } else {
          Alert.alert('Could not start prize run', r.message ?? 'Try again.');
        }
        return false;
      }
      prizeRunReservationRef.current = r.reservationId;
      if (uid) invalidateProfileEconomy(qc, uid);
      return true;
    }
    if (!consumePrizeRunEntryCredits(profileQ.data?.prize_credits)) {
      alertInsufficientPrizeCredits(
        router,
        `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
      );
      return false;
    }
    return true;
  }, [profileQ.data?.prize_credits, qc, router, uid]);

  const startPlaying = useCallback(() => {
    void (async () => {
      manualPrizeRunRef.current = false;
      if (!h2hSkillContest && mode === 'prize') {
        const ok = await chargePrizeRunIfNeeded();
        if (!ok) return;
      }
      resetGame();
      setPhase('playing');
    })();
  }, [chargePrizeRunIfNeeded, h2hSkillContest, mode, resetGame]);

  const startManualPrizeRun = useCallback(() => {
    void (async () => {
      const ok = await chargePrizeRunIfNeeded();
      if (!ok) return;
      manualPrizeRunRef.current = true;
      resetGame();
      setPhase('playing');
    })();
  }, [chargePrizeRunIfNeeded, resetGame]);

  useLayoutEffect(() => {
    if (h2hSkillContest || appliedRoute.current) return;
    const m = String(modeParam ?? '');
    if (m === 'prize') appliedRoute.current = true;
  }, [h2hSkillContest, modeParam]);

  useEffect(() => {
    if (h2hSkillContest) {
      resetGame();
      setPhase('playing');
      return;
    }
    if (routePrizeAutoStartedRef.current) return;
    if (String(modeParam ?? '') !== 'prize') return;
    routePrizeAutoStartedRef.current = true;
    startPlaying();
  }, [h2hSkillContest, modeParam, resetGame, startPlaying]);

  const endRunSnapshot = useCallback(() => {
    const durationMs = Math.max(0, Math.floor(timeMsRef.current));
    lastRunRef.current = {
      score: scoreRef.current,
      durationMs,
      taps: inputSamplesRef.current,
      ringsPassed: ringsPassedRef.current,
      bestStreak: bestStreakRef.current,
      progression: progressionRef.current,
    };
  }, []);

  const runPrizeSubmit = useCallback(() => {
    if (h2hSkillContest) return;
    const durationMs = lastRunRef.current.durationMs;
    void (async () => {
      let tickets = 0;
      const prizeRunActive = mode === 'prize' || manualPrizeRunRef.current;
      if (prizeRunActive) {
        if (ENABLE_BACKEND) {
          if (!assertBackendPrizeSignedIn(ENABLE_BACKEND, uid)) {
            tickets = ticketsFromNeonDanceScore(lastRunRef.current.score);
          } else {
            try {
              const supabase = getSupabase();
              const { data: sess } = await supabase.auth.getSession();
              if (!sess.session) {
                Alert.alert('Sign in required', 'Log in to apply prize credits and redeem tickets.');
                tickets = ticketsFromNeonDanceScore(lastRunRef.current.score);
              } else if (!assertPrizeRunReservation(true, ENABLE_BACKEND, prizeRunReservationRef.current)) {
                tickets = ticketsFromNeonDanceScore(lastRunRef.current.score);
              } else {
                const rid = prizeRunReservationRef.current!;
                const { data, error } = await invokeEdgeFunction('submitMinigameScore', {
                  body: {
                    prize_run: true,
                    prize_run_reservation_id: rid,
                    game_type: 'neon_dance' as const,
                    score: lastRunRef.current.score,
                    duration_ms: durationMs,
                    taps: lastRunRef.current.taps,
                    rings_passed: lastRunRef.current.ringsPassed,
                    best_streak: lastRunRef.current.bestStreak,
                    progression: lastRunRef.current.progression,
                    survival_time_sec: durationMs / 1000,
                    winner_ready: true,
                  },
                });
                if (error) {
                  Alert.alert('Could not save prize run', error.message ?? 'Try again later.');
                  tickets = ticketsFromNeonDanceScore(lastRunRef.current.score);
                } else {
                  const row = data as { tickets_granted?: number } | null;
                  tickets = Math.max(
                    0,
                    typeof row?.tickets_granted === 'number'
                      ? row.tickets_granted
                      : ticketsFromNeonDanceScore(lastRunRef.current.score),
                  );
                  if (uid) invalidateProfileEconomy(qc, uid);
                }
              }
            } catch {
              Alert.alert('Could not save prize run', 'Check your connection and try again.');
              tickets = ticketsFromNeonDanceScore(lastRunRef.current.score);
            }
          }
        } else {
          const n0 = ticketsFromNeonDanceScore(lastRunRef.current.score);
          awardRedeemTicketsForPrizeRun(n0);
          tickets = n0;
        }
      }
      manualPrizeRunRef.current = false;
      setTicketsEarned(prizeRunActive ? tickets : 0);
    })();
  }, [h2hSkillContest, mode, qc, uid]);

  const triggerFail = useCallback(() => {
    if (phaseRef.current !== 'playing' || gameOverLockRef.current) return;
    gameOverLockRef.current = true;
    endRunSnapshot();
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      /* ignore */
    }
    failFlash.setValue(0);
    Animated.sequence([
      Animated.timing(failFlash, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(failFlash, { toValue: 0.65, duration: 120, useNativeDriver: true }),
      Animated.timing(failFlash, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
    setPhase('dying');
  }, [endRunSnapshot, failFlash]);

  useEffect(() => {
    if (phase !== 'dying') return;
    const t = setTimeout(() => {
      setPhase('over');
      const best = bestLocal ?? 0;
      if (scoreRef.current > best) persistBest(scoreRef.current);
      runPrizeSubmit();
    }, 420);
    return () => clearTimeout(t);
  }, [bestLocal, persistBest, phase, runPrizeSubmit]);

  /**
   * Touch layer covers tunnel + hint bar; `locationX/Y` are relative to that layer.
   * Tunnel center in those coords is (winW/2, playAreaH/2) — same for taps on the bar below.
   */
  const applyTouchFromEvent = useCallback(
    (e: GestureResponderEvent) => {
      if (phaseRef.current !== 'playing') return;
      const { locationX, locationY } = e.nativeEvent;
      const cx = winW / 2;
      const cy = playAreaH / 2;
      targetAngleRef.current = Math.atan2(locationY - cy, locationX - cx);
      inputSamplesRef.current += 1;
    },
    [playAreaH, winW],
  );

  const onTouchGrant = useCallback(
    (e: GestureResponderEvent) => {
      if (phaseRef.current !== 'playing') return;
      applyTouchFromEvent(e);
      try {
        void Haptics.selectionAsync();
      } catch {
        /* ignore */
      }
    },
    [applyTouchFromEvent],
  );

  const onTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      applyTouchFromEvent(e);
    },
    [applyTouchFromEvent],
  );

  const cycleBallColor = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const now = timeMsRef.current;
    if (now - lastColorSwitchMsRef.current < 400) return;
    lastColorSwitchMsRef.current = now;
    const n = sectorsRef.current;
    if (n <= 1) return;
    ballIdxRef.current = (ballIdxRef.current + 1) % n;
    setHud((h) => ({ ...h, ballIdx: ballIdxRef.current }));
    inputSamplesRef.current += 1;
    try {
      void Haptics.selectionAsync();
    } catch {
      /* ignore */
    }
  }, []);

  useWebGameKeyboard(Platform.OS === 'web' && phase === 'playing', {
    ArrowLeft: (d) => {
      if (d) {
        targetAngleRef.current -= 0.14;
        inputSamplesRef.current += 1;
      }
    },
    ArrowRight: (d) => {
      if (d) {
        targetAngleRef.current += 0.14;
        inputSamplesRef.current += 1;
      }
    },
    KeyC: (d) => {
      if (d) cycleBallColor();
    },
  });

  useRafLoop(
    (dtMs) => {
      if (phaseRef.current !== 'playing') return;
      runFixedPhysicsSteps(dtMs, (h) => {
        if (gameOverLockRef.current) return false;
        const dt = h / 1000;
        timeMsRef.current += h;
        const t = timeMsRef.current;
        const forward = FORWARD_FIXED;
        forwardQueueRef.current = forward;
        progressionRef.current += forward * 180 * dt;

        const turn = Math.min(1, 18 * dt);
        ballAngleRef.current = normAngle(
          ballAngleRef.current + shortestDelta(ballAngleRef.current, targetAngleRef.current) * turn,
        );

        const orbitR = ringBase * 0.39 * 0.98;
        const bx = stageCenterX + orbitR * Math.cos(ballAngleRef.current);
        const by = stageCenterY + orbitR * Math.sin(ballAngleRef.current);
        trailRef.current.push({ x: bx, y: by });
        while (trailRef.current.length > TRAIL_MAX) trailRef.current.shift();

        if (!forcedThreeColorRef.current && sectorsRef.current === 2 && (t > 45_000 || ringsPassedRef.current >= 7)) {
          forcedThreeColorRef.current = true;
          resetRoundColors(3);
        }

        hoopsRef.current = hoopsRef.current.filter((h) => h.advance < 1.45);

        const hoops = hoopsRef.current;
        for (const hoop of hoops) {
          const prev = hoop.advance;
          hoop.advance += forward * dt;
          hoop.rot += hoop.omega * dt;
          if (prev < HOOP_COLLISION_PLANE && hoop.advance >= HOOP_COLLISION_PLANE) {
            const idx = sectorAtWorldAngle(ballAngleRef.current, hoop.rot, hoop.n);
            if (idx === ballIdxRef.current) {
              ringsPassedRef.current += 1;
              streakRef.current += 1;
              if (streakRef.current > bestStreakRef.current) bestStreakRef.current = streakRef.current;
              const pts = 88 + streakRef.current * 15 + hoop.n * 20;
              scoreRef.current += pts;
              setScore(scoreRef.current);

              if (
                sectorsRef.current >= 3 &&
                ringsPassedRef.current > 0 &&
                ringsPassedRef.current % 9 === 0 &&
                sectorsRef.current < 6
              ) {
                resetRoundColors(sectorsRef.current + 1);
              } else {
                let nb = (Math.random() * sectorsRef.current) | 0;
                if (sectorsRef.current > 1) {
                  while (nb === ballIdxRef.current) nb = (Math.random() * sectorsRef.current) | 0;
                }
                ballIdxRef.current = nb;
              }

              hoopsRef.current = hoops.filter((x) => x.id !== hoop.id);
              pushHoop(-queueGapForForward(forward));
              ensureHoops();

              passBurstRef.current = 1;
              bgPulseRef.current = Math.min(1, bgPulseRef.current + 0.4);
              try {
                void Haptics.impactAsync(
                  streakRef.current % 5 === 0
                    ? Haptics.ImpactFeedbackStyle.Medium
                    : Haptics.ImpactFeedbackStyle.Light,
                );
              } catch {
                /* ignore */
              }

              const pid = nextParticleIdRef.current;
              for (let i = 0; i < PASS_PARTICLE_COUNT; i++) {
                const ang = (Math.PI * 2 * i) / PASS_PARTICLE_COUNT + Math.random() * 0.35;
                const sp = 120 + Math.random() * 170;
                particlesRef.current.push({
                  id: pid + i,
                  x: bx,
                  y: by,
                  vx: Math.cos(ang) * sp,
                  vy: Math.sin(ang) * sp,
                  life: 0.45 + Math.random() * 0.32,
                  color: PALETTE[ballIdxRef.current % PALETTE.length],
                });
              }
              while (particlesRef.current.length > MAX_PARTICLES) particlesRef.current.shift();
              nextParticleIdRef.current = pid + PASS_PARTICLE_COUNT;

              setHud({
                ringsPassed: ringsPassedRef.current,
                streak: streakRef.current,
                sectors: sectorsRef.current,
                ballIdx: ballIdxRef.current,
                pulseBg: bgPulseRef.current,
              });
            } else {
              triggerFail();
              return false;
            }
          }
        }

        const parts = particlesRef.current;
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 380 * dt;
          if (p.life <= 0) parts.splice(i, 1);
        }

        if (passBurstRef.current > 0) passBurstRef.current = Math.max(0, passBurstRef.current - dt * 2.2);
        bgPulseRef.current = Math.max(0, bgPulseRef.current - dt * 0.42);

        return true;
      });
      visualFrameAccRef.current += 1;
      if (visualFrameAccRef.current >= RENDER_FRAME_STRIDE) {
        visualFrameAccRef.current = 0;
        setTick((x) => (x + 1) % 100000);
      }
    },
    phase === 'playing',
  );

  useEffect(() => {
    const wantMusic = (phase === 'playing' || phase === 'paused') && !muted;
    let cancelled = false;

    if (!wantMusic) {
      void soundRef.current?.stopAsync();
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
      return;
    }

    void (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch {
        /* ignore */
      }
      try {
        const { sound } = await Audio.Sound.createAsync(BGM_ASSET, {
          isLooping: true,
          volume: 0.42,
          shouldPlay: false,
        });
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        await sound.playAsync();
      } catch (e) {
        if (__DEV__) console.warn('[NeonDance] bgm', e);
      }
    })();

    return () => {
      cancelled = true;
      const s = soundRef.current;
      soundRef.current = null;
      void s?.unloadAsync();
    };
  }, [muted, phase]);

  const ballColor = PALETTE[hud.ballIdx % PALETTE.length];

  const ringPathsFor = (h: Hoop, scale: number) => {
    const paths = [];
    const sz = ringBase * scale;
    const c = sz / 2;
    const rOut = sz * 0.42;
    const rIn = sz * 0.18;
    const rr = h.rot;
    const nn = h.n;
    for (let i = 0; i < nn; i++) {
      const a0 = (i * (Math.PI * 2)) / nn + rr;
      const a1 = ((i + 1) * (Math.PI * 2)) / nn + rr;
      const col = PALETTE[i % PALETTE.length];
      const dim = h.advance >= 0.95 ? 1 : 0.75 + h.advance * 0.25;
      paths.push(
        <Path
          key={`${h.id}-${i}`}
          d={describeSector(c, c, rOut, rIn, a0, a1)}
          fill={col}
          fillOpacity={dim}
          stroke="none"
        />,
      );
    }
    return paths;
  };

  const pulseBg = 0.04 * (hud.pulseBg + Math.sin(timeMsRef.current / 240) * 0.06);
  /** Stable draw order: coarse zIndex from advance caused ties / flicker (esp. inner “5th” ring on web). */
  const hoopsForRender = [...hoopsRef.current].sort(
    (a, b) => (a.advance !== b.advance ? a.advance - b.advance : a.id - b.id),
  );

  const orbitR = ringBase * 0.39 * 0.98;
  const ballX = stageCenterX + orbitR * Math.cos(ballAngleRef.current);
  const ballY = stageCenterY + orbitR * Math.sin(ballAngleRef.current);

  return (
    <LinearGradient
      colors={['#050508', '#0a0c14', '#12081c']}
      style={styles.fill}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: 0.4 + pulseBg,
            backgroundColor: `rgba(34, 211, 238, ${0.03 + pulseBg * 0.06})`,
          },
        ]}
      />
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <View style={[styles.topBar, { width: stageW }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75 }]}
          >
            <SafeIonicons name="chevron-back" size={26} color="#e2e8f0" />
          </Pressable>
          <View style={styles.topMid}>
            <Text style={styles.scoreTop}>{score.toLocaleString()}</Text>
            <Text style={styles.subTop}>
              hoops {hud.ringsPassed} · ×{hud.streak} · {hud.sectors} colors
            </Text>
          </View>
          <View style={styles.topRight}>
            {phase === 'playing' || phase === 'paused' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Unmute music' : 'Mute music'}
                onPress={() => setMuted((m) => !m)}
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75 }]}
              >
                <SafeIonicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#cbd5e1" />
              </Pressable>
            ) : null}
            {phase === 'playing' || phase === 'paused' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={phase === 'paused' ? 'Resume' : 'Pause'}
                onPress={() => setPhase((p) => (p === 'playing' ? 'paused' : 'playing'))}
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75 }]}
              >
                <SafeIonicons name={phase === 'paused' ? 'play' : 'pause'} size={22} color="#e2e8f0" />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Home"
              onPress={() => router.replace(ROUTE_HOME)}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75 }]}
            >
              <SafeIonicons name="home" size={22} color="#e2e8f0" />
            </Pressable>
          </View>
        </View>

        {phase === 'ready' && !h2hSkillContest ? (
          <View style={styles.centerBlock}>
            <Text style={styles.logoMark}>NEON DANCE</Text>
            <Text style={styles.title}>Neon Dance</Text>
            <Text style={styles.blurb}>
              Drag anywhere to aim. Hoops keep the same pace — it gets harder when you cycle ball color (chip) and when
              rings gain a third color (then more), not from speeding up. After enough hoops or ~45s, rings add that third
              slice. Wrong segment ends the run.
            </Text>
            {bestLocal != null ? (
              <Text style={styles.bestLbl}>Best run · {bestLocal.toLocaleString()} pts</Text>
            ) : null}
            <AppButton title="Play" onPress={startPlaying} />
            <AppButton className="mt-2" title="Prize run" variant="secondary" onPress={startManualPrizeRun} />
            <Pressable style={styles.muteRow} onPress={() => setMuted((m) => !m)}>
              <SafeIonicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#94a3b8" />
              <Text style={styles.muteTxt}>{muted ? 'Music off' : 'Music on'}</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'playing' || phase === 'paused' || phase === 'dying' ? (
          <View style={styles.playfield}>
            <View style={styles.playfieldInner}>
            <View style={[styles.stageClip, { height: playAreaH, width: winW }]} pointerEvents="none">
              {/* Tunnel depth: concentric rings (memo child — not tied to `tick`) */}
              <NeonDanceTunnelRings
                winW={winW}
                playAreaH={playAreaH}
                stageCenterX={stageCenterX}
                stageCenterY={stageCenterY}
              />

              {hoopsForRender.map((h, hoopSortIndex) => {
                const vis = approachScale(h.advance);
                if (vis < 0.05) return null;
                const dimPx = ringBase * vis;
                const hSvg = dimPx * 0.92;
                /** Integer position only — keeps subpixel jitter low on mobile Safari; SVG matches `ringPathsFor` (`dimPx`). */
                const left = Math.round(stageCenterX - dimPx / 2);
                const top = Math.round(stageCenterY - dimPx / 2);
                return (
                  <View
                    key={h.id}
                    style={[
                      styles.hoopLayer,
                      Platform.OS === 'web' && styles.hoopLayerWeb,
                      {
                        left,
                        top,
                        width: dimPx,
                        height: dimPx * 0.9,
                        zIndex: 20 + hoopSortIndex,
                        opacity: 0.55 + 0.45 * Math.min(1, h.advance + 0.2),
                      },
                    ]}
                  >
                    <Svg width={dimPx} height={hSvg}>
                      {ringPathsFor(h, vis)}
                      <Circle
                        cx={dimPx / 2}
                        cy={dimPx / 2}
                        r={dimPx * 0.1}
                        fill="#f8fafc"
                        opacity={0.88}
                      />
                      <Circle
                        cx={dimPx / 2}
                        cy={dimPx / 2}
                        r={dimPx * 0.055}
                        fill="#e0f2fe"
                      />
                    </Svg>
                  </View>
                );
              })}

              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ballLayerAboveHoops]}>
                <Svg style={StyleSheet.absoluteFill} width={winW} height={playAreaH} pointerEvents="none">
                  {trailRef.current.map((pt, i) => (
                    <Circle
                      key={`t-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={3 + (i / Math.max(1, trailRef.current.length)) * 5}
                      fill={ballColor}
                      opacity={0.1 + (i / Math.max(1, trailRef.current.length)) * 0.35}
                    />
                  ))}
                  {particlesRef.current.map((p) => (
                    <Circle
                      key={p.id}
                      cx={p.x}
                      cy={p.y}
                      r={4}
                      fill={p.color}
                      opacity={Math.max(0, p.life * 1.8)}
                    />
                  ))}
                  <Circle cx={ballX} cy={ballY} r={BALL_R + 5} fill={ballColor} opacity={0.28} />
                  <Circle
                    cx={ballX}
                    cy={ballY}
                    r={BALL_R}
                    fill={ballColor}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={2}
                  />
                </Svg>
              </View>

              <Text style={styles.hidden}>{tick}</Text>
            </View>

            <View
              style={[
                styles.swipeBar,
                {
                  marginBottom: 10 + insets.bottom,
                  width: Math.min(stageW, winW) - 20,
                  zIndex: 2,
                  elevation: 2,
                },
              ]}
              pointerEvents="none"
            >
              <SafeIonicons name="finger-print" size={26} color="rgba(248,250,252,0.9)" style={styles.swipeIcon} />
              <Text style={styles.swipeHint}>Drag anywhere above or here to spin 360°</Text>
            </View>

            <View
              style={[styles.touchLayer, Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as const) : null]}
              onStartShouldSetResponder={() => phaseRef.current === 'playing'}
              onMoveShouldSetResponder={() => phaseRef.current === 'playing'}
              onStartShouldSetResponderCapture={() => phaseRef.current === 'playing'}
              onMoveShouldSetResponderCapture={() => phaseRef.current === 'playing'}
              onResponderTerminationRequest={() => false}
              onResponderGrant={onTouchGrant}
              onResponderMove={onTouchMove}
            />

            </View>

            <View style={styles.hudGlass}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cycle ball color"
                onPress={cycleBallColor}
                hitSlop={10}
                style={({ pressed }) => [styles.swatchPress, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.swatch, { backgroundColor: ballColor, shadowColor: ballColor }]} />
              </Pressable>
              <Text style={styles.hudTxt}>
                Drag to aim · tap chip to switch color · 3+ colors appear as you survive
              </Text>
            </View>
          </View>
        ) : null}

        {phase === 'paused' ? (
          <Pressable style={styles.pauseOverlay} onPress={() => setPhase('playing')}>
            <View style={styles.pauseCard}>
              <Text style={styles.pauseTitle}>Paused</Text>
              <Text style={styles.pauseSub}>Tap anywhere to resume</Text>
              <Pressable onPress={() => setMuted((m) => !m)} style={styles.muteRow}>
                <SafeIonicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#94a3b8" />
                <Text style={styles.muteTxt}>{muted ? 'Muted' : 'Sound on'}</Text>
              </Pressable>
            </View>
          </Pressable>
        ) : null}

        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#fb7185',
              opacity: failFlash,
            },
          ]}
        />

        {phase === 'over' ? (
          <View style={styles.overLay}>
            <Text style={styles.overTitle}>Run ended</Text>
            <Text style={styles.overScore}>{score.toLocaleString()} pts</Text>
            <Text style={styles.statLine}>Hoops cleared · {hud.ringsPassed}</Text>
            <Text style={styles.statLine}>
              Time · {(lastRunRef.current.durationMs / 1000).toFixed(1)}s
            </Text>
            <Text style={styles.statLine}>Best streak · {lastRunRef.current.bestStreak}</Text>
            <Text style={styles.statLine}>Distance · {Math.floor(lastRunRef.current.progression)}</Text>
            {mode === 'prize' && !h2hSkillContest ? (
              <Text style={styles.tickets}>
                {ticketsEarned > 0 ? `+${ticketsEarned} redeem tickets` : 'No tickets this run'}
              </Text>
            ) : null}
            {h2hSkillContest ? (
              <Text style={styles.overSub}>
                {h2hSubmitPhase === 'loading'
                  ? 'Submitting score…'
                  : h2hSubmitPhase === 'error'
                    ? 'Could not submit — check connection.'
                    : h2hPoll?.both_submitted
                      ? 'Both scores in. Resolving…'
                      : 'Score sent — waiting for opponent…'}
              </Text>
            ) : null}
            {h2hSkillContest && h2hSubmitPhase === 'error' ? (
              <AppButton title="Retry submit" onPress={() => setH2hRetryKey((k) => k + 1)} />
            ) : null}
            {!h2hSkillContest ? (
              <>
                <AppButton title="Play again" onPress={startPlaying} />
                <GameOverExitRow
                  onMinigames={() => router.replace(ROUTE_MINIGAMES)}
                  onHome={() => router.replace(ROUTE_HOME)}
                />
              </>
            ) : null}
          </View>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    paddingHorizontal: 8,
    marginBottom: 4,
    zIndex: 20,
  },
  topMid: { alignItems: 'center', flex: 1 },
  subTop: { color: 'rgba(148,163,184,0.95)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 8 },
  scoreTop: { color: '#f8fafc', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  centerBlock: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  logoMark: {
    color: 'rgba(34,211,238,0.9)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 4,
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  blurb: { color: 'rgba(226,232,240,0.88)', fontSize: 14, lineHeight: 21, marginBottom: 4 },
  bestLbl: { color: '#fde68a', fontWeight: '800', fontSize: 15 },
  muteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, alignSelf: 'center' },
  muteTxt: { color: '#94a3b8', fontSize: 13 },
  playfield: { flex: 1 },
  playfieldInner: {
    position: 'relative',
    alignSelf: 'center',
    width: '100%',
  },
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 55,
    elevation: 20,
  },
  stageClip: { overflow: 'hidden', position: 'relative', backgroundColor: 'rgba(3,7,18,0.96)' },
  swipeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    minHeight: SWIPE_BAR_HEIGHT,
    borderRadius: 22,
    backgroundColor: 'rgba(2,6,23,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    marginTop: 4,
    alignSelf: 'center',
    shadowColor: '#22d3ee',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  swipeIcon: { marginRight: 2 },
  swipeHint: {
    flex: 1,
    color: 'rgba(226,232,240,0.92)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  hoopLayer: {
    position: 'absolute',
    ...Platform.select({
      ios: {
        shadowColor: '#22d3ee',
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {
        elevation: 4,
        shadowColor: '#22d3ee',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  /** Web: hoop shadows create stacking contexts; Safari can paint them above the ball SVG. */
  hoopLayerWeb: {
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  ballLayerAboveHoops: {
    zIndex: 500,
    elevation: 500,
  },
  hudGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  swatchPress: { borderRadius: 22, padding: 2 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowOpacity: 0.85,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  hudTxt: { color: '#e2e8f0', fontWeight: '700', fontSize: 12, flex: 1 },
  hidden: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  pauseCard: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    alignItems: 'center',
    gap: 8,
  },
  pauseTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  pauseSub: { color: '#94a3b8', fontSize: 14 },
  overLay: { paddingHorizontal: 20, paddingBottom: 24, gap: 6, zIndex: 40 },
  overTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  overScore: { color: '#fde68a', fontSize: 22, fontWeight: '900' },
  statLine: { color: 'rgba(203,213,225,0.95)', fontSize: 15, fontWeight: '700' },
  overSub: { color: 'rgba(203,213,225,0.92)', fontSize: 14 },
  tickets: { color: '#5eead4', fontWeight: '800' },
});
