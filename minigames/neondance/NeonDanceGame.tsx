import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { AppButton } from '@/components/ui/AppButton';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { useProfile } from '@/hooks/useProfile';
import { alertInsufficientPrizeCredits } from '@/lib/arcadeCreditsShop';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { beginMinigamePrizeRun } from '@/lib/beginMinigamePrizeRun';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { assertBackendPrizeSignedIn, assertPrizeRunReservation } from '@/lib/prizeRunGuards';
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

const FORWARD_FIXED = 0.12;
const THREE_COLOR_FORWARD_MULT = 0.76;
const TIER_UP_HOOP_BREATHE_ADV = 0.48;

/**
 * FIX 1: Collision plane moved back to 1.0 (exactly at player plane).
 * The old 1.012 caused hoops to "pass through" before triggering, making near-misses feel
 * like late deaths. Exact 1.0 matches what the player sees visually.
 */
const HOOP_COLLISION_PLANE = 1.0;

/**
 * FIX 2: Grace window at game start — no collision fires in the first N ms.
 * Gives the player time to see the first hoop and orient their ball color.
 */
const GRACE_PERIOD_MS = 2200;

const HOOP_QUEUE_GAP_MIN_2 = 0.54;
const HOOP_QUEUE_GAP_MAX_2 = 2.45;
const HOOP_QUEUE_GAP_MIN_3PLUS = 0.66;
const HOOP_QUEUE_GAP_MAX_3PLUS = 2.65;
const HOOP_ARRIVAL_MIN_SEC_2 = 0.52;
const HOOP_ARRIVAL_MIN_SEC_3PLUS = 0.78;
/** Extra queue gap while `ringsPassed` is below this (opening stretch / ~6th–8th hoop fairness). */
const EARLY_RING_GAP_PASS_THRESHOLD = 8;

function queueGapForForward(forward: number, sectorCount: number, ringsPassed: number): number {
  const f = Math.max(1e-4, forward);
  const minG = sectorCount >= 3 ? HOOP_QUEUE_GAP_MIN_3PLUS : HOOP_QUEUE_GAP_MIN_2;
  const maxG = sectorCount >= 3 ? HOOP_QUEUE_GAP_MAX_3PLUS : HOOP_QUEUE_GAP_MAX_2;
  const minSec = sectorCount >= 3 ? HOOP_ARRIVAL_MIN_SEC_3PLUS : HOOP_ARRIVAL_MIN_SEC_2;
  let g = Math.min(maxG, Math.max(minG, f * minSec - 1));
  if (ringsPassed < EARLY_RING_GAP_PASS_THRESHOLD) {
    g = Math.min(maxG, g + (sectorCount >= 3 ? 0.16 : 0.22));
  }
  return g;
}
const SWIPE_BAR_HEIGHT = 84;

const MAX_PARTICLES = 28;
const PASS_PARTICLE_COUNT = 8;
const TRAIL_MAX = 12;
const TUNNEL_RING_COUNT = 6;
const RENDER_FRAME_STRIDE = 2;

export type NeonDanceRunPayload = {
  score: number;
  ringsPassed: number;
  survivalTime: number;
  bestStreak: number;
  progression: number;
  winnerReady: true;
};

const PALETTE = ['#ff2d92', '#FFD700', '#c084fc', '#bef264', '#fb923c', '#3b82f6'];
/** Darker glow variants for sector highlights (used in the "next sector" indicator) */
const PALETTE_GLOW = ['#ff6bb8', '#ffe082', '#d8b4fe', '#d9f99d', '#fdba74', '#c4b5fd'];

function normAngle(a: number): number {
  let x = a % (Math.PI * 2);
  if (x < 0) x += Math.PI * 2;
  return x;
}

function shortestDelta(a: number, b: number): number {
  const da = normAngle(a);
  const db = normAngle(b);
  let d = db - da;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

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

function approachScale(p: number): number {
  const t = Math.max(0, Math.min(1, (p + 0.12) / 1.12));
  return 0.2 + 0.8 * (t * t * (3 - 2 * t));
}

type Hoop = {
  id: number;
  advance: number;
  rot: number;
  omega: number;
  n: number;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

const NeonDanceTunnelRings = memo(function NeonDanceTunnelRings({
  winW,
  playAreaH,
  stageCenterX,
  stageCenterY,
  pulsePhase,
}: {
  winW: number;
  playAreaH: number;
  stageCenterX: number;
  stageCenterY: number;
  pulsePhase: number;
}) {
  const dim = Math.min(winW, playAreaH);
  return (
    <Svg
      style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
      width={winW}
      height={playAreaH}
      pointerEvents="none"
    >
      {/* Perspective grid lines to enhance depth illusion */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const len = dim * 0.52;
        return (
          <Line
            key={`grid-${i}`}
            x1={stageCenterX}
            y1={stageCenterY}
            x2={stageCenterX + Math.cos(angle) * len}
            y2={stageCenterY + Math.sin(angle) * len}
            stroke="rgba(148,163,184,0.06)"
            strokeWidth={1}
          />
        );
      })}
      {/* Depth rings — more rings, subtle breathing animation via pulsePhase */}
      {Array.from({ length: TUNNEL_RING_COUNT }, (_, i) => {
        const baseR = 22 + i * dim * 0.085;
        const breathe = Math.sin(pulsePhase + i * 0.9) * 1.2;
        const r = baseR + breathe;
        const baseO = 0.04 + i * 0.028;
        const o = baseO + Math.sin(pulsePhase * 1.3 + i) * 0.015;
        return (
          <Circle
            key={`tun-${i}`}
            cx={stageCenterX}
            cy={stageCenterY}
            r={r}
            stroke="rgba(148,163,184,0.4)"
            strokeWidth={1}
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
    /** For the "next sector" guide indicator */
    nextHoopSectorAtBall: -1,
    inGrace: true,
  });
  const [ticketsEarned, setTicketsEarned] = useState(0);
  const [bestLocal, setBestLocal] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);

  const mode = h2hSkillContest ? 'h2h' : playMode === 'prize' ? 'prize' : 'practice';
  const appliedRoute = useRef(false);
  const prizeRunReservationRef = useRef<string | null>(null);
  const routePrizeAutoStartedRef = useRef(false);
  const manualPrizeRunRef = useRef(false);

  const hoopsRef = useRef<Hoop[]>([]);
  const nextHoopIdRef = useRef(1);
  const ballAngleRef = useRef(Math.PI / 2);
  const targetAngleRef = useRef(Math.PI / 2);
  const trailRef = useRef<{ x: number; y: number; t: number }[]>([]);
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
  const forwardQueueRef = useRef(FORWARD_FIXED);
  const bgPulseRef = useRef(0);
  const passBurstRef = useRef(0);
  /** Accumulated time for tunnel ring breathing animation */
  const tunnelPhaseRef = useRef(0);
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
  const visualFrameAccRef = useRef(0);
  const forcedThreeColorRef = useRef(false);
  const insets = useSafeAreaInsets();

  const playAreaH = Math.max(360, winH - 220 - SWIPE_BAR_HEIGHT - Math.min(32, insets.bottom));
  const ringBase = Math.min(stageW - 24, 320);
  const BALL_R = Math.max(13, ringBase * 0.052);
  const stageCenterX = winW / 2;
  const stageCenterY = playAreaH / 2;

  const resetRoundColors = useCallback((n: number) => {
    const prevN = sectorsRef.current;
    sectorsRef.current = n;
    const b = (Math.random() * n) | 0;
    ballIdxRef.current = b;
    for (const h of hoopsRef.current) {
      h.n = n;
    }
    if (n > prevN) {
      for (const h of hoopsRef.current) {
        h.advance -= TIER_UP_HOOP_BREATHE_ADV;
      }
    }
    setHud((prev) => ({ ...prev, sectors: n, ballIdx: b }));
  }, []);

  const pushHoop = useCallback((advance: number) => {
    const n = sectorsRef.current;
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
      /**
       * FIX 3: First hoop spawns much further away (−0.18 instead of 0.58)
       * so the player has a solid ~8 seconds before first collision.
       * Combined with the grace period, this guarantees time to orient.
       */
      pushHoop(-0.18);
      pushHoop(-0.72);
      pushHoop(-1.28);
      return;
    }
    let minAdv = Math.min(...list.map((h) => h.advance));
    let guard = 0;
    while (minAdv > -0.08 && guard++ < 10) {
      const gap = queueGapForForward(forwardQueueRef.current, sectorsRef.current, ringsPassedRef.current);
      minAdv -= gap;
      pushHoop(minAdv);
    }
  }, [pushHoop]);

  const resetGame = useCallback(() => {
    gameOverLockRef.current = false;
    visualFrameAccRef.current = 0;
    forcedThreeColorRef.current = false;
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
    tunnelPhaseRef.current = 0;
    bgPulseRef.current = 0;
    passBurstRef.current = 0;
    sectorsRef.current = 2;
    const b = (Math.random() * 2) | 0;
    ballIdxRef.current = b;
    setScore(0);
    setHud({ ringsPassed: 0, streak: 0, sectors: 2, ballIdx: b, pulseBg: 0, nextHoopSectorAtBall: -1, inGrace: true });
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
  });

  useRafLoop(
    (dtMs) => {
      if (phaseRef.current !== 'playing') return;
      runFixedPhysicsSteps(dtMs, (h) => {
        if (gameOverLockRef.current) return false;
        const dt = h / 1000;
        timeMsRef.current += h;
        const t = timeMsRef.current;
        const forward =
          FORWARD_FIXED * (sectorsRef.current >= 3 ? THREE_COLOR_FORWARD_MULT : 1);
        forwardQueueRef.current = forward;
        progressionRef.current += forward * 180 * dt;
        tunnelPhaseRef.current += dt * 0.8;

        const turn = Math.min(1, 18 * dt);
        ballAngleRef.current = normAngle(
          ballAngleRef.current + shortestDelta(ballAngleRef.current, targetAngleRef.current) * turn,
        );

        const orbitR = ringBase * 0.39 * 0.98;
        const bx = stageCenterX + orbitR * Math.cos(ballAngleRef.current);
        const by = stageCenterY + orbitR * Math.sin(ballAngleRef.current);
        trailRef.current.push({ x: bx, y: by, t });
        while (trailRef.current.length > TRAIL_MAX) trailRef.current.shift();

        if (!forcedThreeColorRef.current && sectorsRef.current === 2 && (t > 45_000 || ringsPassedRef.current >= 7)) {
          forcedThreeColorRef.current = true;
          resetRoundColors(3);
        }

        /**
         * Integrate all hoops, then resolve at most one plane crossing per step (frontmost first).
         * If two rings cross y=1 in the same 1/60s slice, evaluating both could fail the rear one
         * unfairly ("instant" death) — the player only ever meets one ring at the focal plane.
         */
        const hoops = hoopsRef.current;
        const prevAdv = new Map<number, number>();
        for (const hoop of hoops) prevAdv.set(hoop.id, hoop.advance);
        for (const hoop of hoops) {
          hoop.advance += forward * dt;
          hoop.rot += hoop.omega * dt;
        }

        const crossed = hoops.filter((hoop) => {
          const prev = prevAdv.get(hoop.id) ?? hoop.advance;
          return prev < HOOP_COLLISION_PLANE && hoop.advance >= HOOP_COLLISION_PLANE;
        });
        crossed.sort((a, b) => b.advance - a.advance);
        for (let i = 1; i < crossed.length; i++) {
          crossed[i].advance = HOOP_COLLISION_PLANE - 0.004;
        }

        let failedThisStep = false;
        let passedId = -1;

        if (crossed.length > 0) {
          const hoop = crossed[0];
          /** FIX 5: Grace period — no scored collision in the first GRACE_PERIOD_MS. */
          if (t < GRACE_PERIOD_MS) {
            passedId = hoop.id;
          } else {
            const idx = sectorAtWorldAngle(ballAngleRef.current, hoop.rot, hoop.n);
            if (idx === ballIdxRef.current) {
              ringsPassedRef.current += 1;
              streakRef.current += 1;
              if (streakRef.current > bestStreakRef.current) bestStreakRef.current = streakRef.current;
              const pts = 88 + streakRef.current * 15 + hoop.n * 20;
              scoreRef.current += pts;
              setScore(scoreRef.current);

              let nb = (Math.random() * sectorsRef.current) | 0;
              if (sectorsRef.current > 1) {
                while (nb === ballIdxRef.current) nb = (Math.random() * sectorsRef.current) | 0;
              }
              ballIdxRef.current = nb;

              passedId = hoop.id;

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
                const ang = (Math.PI * 2 * i) / PASS_PARTICLE_COUNT + Math.random() * 0.5;
                const sp = 100 + Math.random() * 200;
                const lifespan = 0.5 + Math.random() * 0.35;
                particlesRef.current.push({
                  id: pid + i,
                  x: bx,
                  y: by,
                  vx: Math.cos(ang) * sp,
                  vy: Math.sin(ang) * sp,
                  life: lifespan,
                  maxLife: lifespan,
                  color: PALETTE[ballIdxRef.current % PALETTE.length],
                  size: 3 + Math.random() * 4,
                });
              }
              while (particlesRef.current.length > MAX_PARTICLES) particlesRef.current.shift();
              nextParticleIdRef.current = pid + PASS_PARTICLE_COUNT;
            } else {
              failedThisStep = true;
            }
          }
        }

        if (failedThisStep) {
          triggerFail();
          return false;
        }

        /** Remove passed/expired hoops AFTER collision logic, then queue replacements. */
        if (passedId !== -1) {
          hoopsRef.current = hoopsRef.current.filter((x) => x.id !== passedId);
          pushHoop(-queueGapForForward(forward, sectorsRef.current, ringsPassedRef.current));
          ensureHoops();
        }
        hoopsRef.current = hoopsRef.current.filter((h) => h.advance < 1.45);
        ensureHoops();

        const parts = particlesRef.current;
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.vy += 320 * dt;
          if (p.life <= 0) parts.splice(i, 1);
        }

        if (passBurstRef.current > 0) passBurstRef.current = Math.max(0, passBurstRef.current - dt * 2.2);
        bgPulseRef.current = Math.max(0, bgPulseRef.current - dt * 0.42);

        /**
         * Visual aid: compute which sector the nearest hoop has at the ball's current angle.
         * This lets us draw a subtle "target sector" indicator.
         */
        const nearestHoop = hoopsRef.current.reduce<Hoop | null>((best, h) => {
          if (h.advance < 0) return best;
          if (!best || h.advance < best.advance) return h;
          return best;
        }, null);
        const nextSector = nearestHoop
          ? sectorAtWorldAngle(ballAngleRef.current, nearestHoop.rot, nearestHoop.n)
          : -1;

        setHud({
          ringsPassed: ringsPassedRef.current,
          streak: streakRef.current,
          sectors: sectorsRef.current,
          ballIdx: ballIdxRef.current,
          pulseBg: bgPulseRef.current,
          nextHoopSectorAtBall: nextSector,
          inGrace: t < GRACE_PERIOD_MS,
        });

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
  const ballGlow = PALETTE_GLOW[hud.ballIdx % PALETTE_GLOW.length];

  const ringPathsFor = (h: Hoop, scale: number, isNearest: boolean) => {
    const paths = [];
    const sz = ringBase * scale;
    const c = sz / 2;
    const rOut = sz * 0.44;
    const rIn = sz * 0.17;
    const rr = h.rot;
    const nn = h.n;
    for (let i = 0; i < nn; i++) {
      const a0 = (i * (Math.PI * 2)) / nn + rr;
      const a1 = ((i + 1) * (Math.PI * 2)) / nn + rr;
      const col = PALETTE[i % PALETTE.length];
      /**
       * Visual improvement: matched sector (same as ball color) gets a brightness boost
       * on the nearest hoop to give a subtle "this is where to aim" cue.
       */
      const isMatch = isNearest && i === ballIdxRef.current;
      const baseDim = h.advance >= 0.95 ? 1 : 0.72 + h.advance * 0.28;
      const opacity = isMatch ? Math.min(1, baseDim + 0.25) : baseDim;
      paths.push(
        <Path
          key={`${h.id}-${i}`}
          d={describeSector(c, c, rOut, rIn, a0, a1)}
          fill={col}
          fillOpacity={opacity}
          stroke={isMatch ? 'rgba(255,255,255,0.45)' : 'none'}
          strokeWidth={isMatch ? 1.5 : 0}
        />,
      );
    }
    /** Center dot — brighter on near hoops */
    const centerOp = 0.7 + h.advance * 0.3;
    paths.push(
      <Circle key={`${h.id}-c1`} cx={c} cy={c} r={sz * 0.09} fill="rgba(255,255,255,0.9)" opacity={centerOp} />,
      <Circle key={`${h.id}-c2`} cx={c} cy={c} r={sz * 0.05} fill="#FFF8E1" opacity={centerOp} />,
    );
    return paths;
  };

  const pulseBg = 0.04 * (hud.pulseBg + Math.sin(timeMsRef.current / 240) * 0.06);
  const hoopsForRender = [...hoopsRef.current].sort(
    (a, b) => (a.advance !== b.advance ? a.advance - b.advance : a.id - b.id),
  );
  /**
   * The nearest visible hoop (advance > 0) gets the match-sector highlight treatment.
   */
  const nearestVisibleId = hoopsForRender.find((h) => h.advance >= 0)?.id ?? -1;

  const orbitR = ringBase * 0.39 * 0.98;
  const ballX = stageCenterX + orbitR * Math.cos(ballAngleRef.current);
  const ballY = stageCenterY + orbitR * Math.sin(ballAngleRef.current);

  /** Grace period countdown for HUD display */
  const graceRemainSec = Math.max(0, (GRACE_PERIOD_MS - timeMsRef.current) / 1000);

  return (
    <LinearGradient
      colors={['#040408', '#08091200', '#100720']}
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
            backgroundColor: `rgba(255, 215, 0, ${0.025 + pulseBg * 0.05})`,
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
              ×{hud.streak} streak · {hud.sectors} colors · {hud.ringsPassed} hoops
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
              Drag anywhere to rotate. Match your ball color to the glowing sector as hoops approach.
              Wrong sector ends the run.
            </Text>
            {bestLocal != null ? (
              <Text style={styles.bestLbl}>Best · {bestLocal.toLocaleString()} pts</Text>
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
                {/* Tunnel depth rings — breathe with tunnelPhaseRef */}
                <NeonDanceTunnelRings
                  winW={winW}
                  playAreaH={playAreaH}
                  stageCenterX={stageCenterX}
                  stageCenterY={stageCenterY}
                  pulsePhase={tunnelPhaseRef.current}
                />

                {hoopsForRender.map((h, hoopSortIndex) => {
                  const vis = approachScale(h.advance);
                  if (vis < 0.05) return null;
                  const dimPx = ringBase * vis;
                  const hSvg = dimPx;
                  const left = Math.round(stageCenterX - dimPx / 2);
                  const top = Math.round(stageCenterY - dimPx / 2);
                  const isNearest = h.id === nearestVisibleId;
                  /**
                   * Visual improvement: warn zone — when a hoop is very close, add a
                   * faint red border pulse so the player feels urgency.
                   */
                  const warnAlpha = h.advance > 0.82 ? (h.advance - 0.82) / 0.18 : 0;
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
                          height: dimPx,
                          zIndex: 20 + hoopSortIndex,
                          opacity: 0.5 + 0.5 * Math.min(1, h.advance + 0.25),
                        },
                      ]}
                    >
                      <Svg width={dimPx} height={hSvg}>
                        {ringPathsFor(h, vis, isNearest)}
                        {/* Warning pulse ring when close */}
                        {warnAlpha > 0 ? (
                          <Circle
                            cx={dimPx / 2}
                            cy={dimPx / 2}
                            r={dimPx * 0.445}
                            fill="none"
                            stroke="rgba(251,113,133,0.7)"
                            strokeWidth={2}
                            opacity={warnAlpha * 0.6}
                          />
                        ) : null}
                      </Svg>
                    </View>
                  );
                })}

                <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ballLayerAboveHoops]}>
                  <Svg style={StyleSheet.absoluteFill} width={winW} height={playAreaH} pointerEvents="none">
                    {/* Trail — fades and grows toward ball */}
                    {trailRef.current.map((pt, i) => {
                      const frac = i / Math.max(1, trailRef.current.length - 1);
                      return (
                        <Circle
                          key={`t-${i}`}
                          cx={pt.x}
                          cy={pt.y}
                          r={2 + frac * 6}
                          fill={ballColor}
                          opacity={0.06 + frac * 0.28}
                        />
                      );
                    })}
                    {/* Particles — size varies */}
                    {particlesRef.current.map((p) => {
                      const frac = Math.max(0, p.life / p.maxLife);
                      return (
                        <Circle
                          key={p.id}
                          cx={p.x}
                          cy={p.y}
                          r={p.size * frac}
                          fill={p.color}
                          opacity={Math.max(0, frac * 1.4)}
                        />
                      );
                    })}
                    {/* Ball outer glow */}
                    <Circle cx={ballX} cy={ballY} r={BALL_R + 10} fill={ballGlow} opacity={0.12} />
                    <Circle cx={ballX} cy={ballY} r={BALL_R + 5} fill={ballColor} opacity={0.22} />
                    {/* Ball core */}
                    <Circle
                      cx={ballX}
                      cy={ballY}
                      r={BALL_R}
                      fill={ballColor}
                      stroke="rgba(255,255,255,0.92)"
                      strokeWidth={2.5}
                    />
                    {/* Ball specular highlight */}
                    <Circle
                      cx={ballX - BALL_R * 0.28}
                      cy={ballY - BALL_R * 0.28}
                      r={BALL_R * 0.3}
                      fill="rgba(255,255,255,0.45)"
                    />
                    {/* Grace period: orbit guide ring */}
                    {hud.inGrace ? (
                      <Circle
                        cx={stageCenterX}
                        cy={stageCenterY}
                        r={orbitR}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth={1}
                        fill="none"
                        strokeDasharray="6,8"
                      />
                    ) : null}
                  </Svg>
                </View>

                {/* Grace period countdown banner */}
                {hud.inGrace && phase === 'playing' ? (
                  <View style={styles.graceBanner} pointerEvents="none">
                    <Text style={styles.graceText}>
                      Get ready — {graceRemainSec.toFixed(1)}s
                    </Text>
                  </View>
                ) : null}

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
                <Text style={styles.swipeHint}>Drag to spin · line up with the bright sector</Text>
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
              <View
                accessibilityLabel="Current ball color"
                importantForAccessibility="yes"
                style={styles.swatchWrap}
              >
                <View style={[styles.swatch, { backgroundColor: ballColor, shadowColor: ballColor }]} />
              </View>
              <View style={styles.hudTextBlock}>
                <Text style={styles.hudTxt}>Drag to aim · match the glowing sector</Text>
                {hud.streak >= 3 ? (
                  <Text style={[styles.streakLabel, { color: ballColor }]}>
                    🔥 {hud.streak} streak
                  </Text>
                ) : null}
              </View>
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
    color: 'rgba(255,215,0,0.9)',
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
  stageClip: { overflow: 'hidden', position: 'relative', backgroundColor: 'rgba(2,4,14,0.97)' },
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
    shadowColor: '#FFD700',
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
        shadowColor: '#FFD700',
        shadowOpacity: 0.3,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {
        elevation: 4,
        shadowColor: '#FFD700',
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
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
    backgroundColor: 'rgba(10,15,30,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  hudTextBlock: { flex: 1, gap: 2 },
  swatchWrap: { borderRadius: 24, padding: 2 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  hudTxt: { color: '#94a3b8', fontWeight: '600', fontSize: 12 },
  streakLabel: { fontSize: 13, fontWeight: '800' },
  hidden: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  graceBanner: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  graceText: {
    color: 'rgba(203,213,225,0.82)',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(2,6,23,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    overflow: 'hidden',
  },
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
    backgroundColor: 'rgba(10,15,30,0.96)',
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
  tickets: { color: '#FFD700', fontWeight: '800' },
});