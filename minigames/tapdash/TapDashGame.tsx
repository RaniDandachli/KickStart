import { useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { beginMinigamePrizeRun } from '@/lib/beginMinigamePrizeRun';
import { assertBackendPrizeSignedIn, assertPrizeRunReservation } from '@/lib/prizeRunGuards';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { alertInsufficientPrizeCredits, pushArcadeCreditsShop } from '@/lib/arcadeCreditsShop';
import { awardRedeemTicketsForPrizeRun, TAP_DASH_POINTS_PER_TICKET, ticketsFromTapDashScore } from '@/lib/ticketPayouts';
import { arcade } from '@/lib/arcadeTheme';
import { runit } from '@/lib/runitArcadeTheme';
import { getSupabase } from '@/supabase/client';
import {
  MINIGAME_HUD_MS,
  resetMinigameHudClock,
  shouldEmitMinigameHudFrame,
} from '@/minigames/core/minigameHudThrottle';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { GameOverExitRow, ROUTE_HOME } from '@/minigames/ui/GameOverExitRow';
import { useMinigameExitNav } from '@/minigames/ui/useMinigameExitNav';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { useLockNavigatorGesturesWhile } from '@/minigames/ui/useLockNavigatorGesturesWhile';
import { minigameImmersiveStageWidth, minigameStageMaxWidth } from '@/minigames/ui/minigameWebMaxWidth';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { useAuthStore } from '@/store/authStore';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useProfile } from '@/hooks/useProfile';
import { finalizeDailyScores } from '@/lib/dailyFreeTournament';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';
import {
  clearLastMinigameAttempt,
  loadLastMinigameAttempt,
  saveLastMinigameAttempt,
  type LastMinigameAttempt,
} from '@/lib/lastMinigameScoreAttempt';
import { onWeeklyRaceAfterMinigameScore } from '@/lib/weeklyRaceAfterScore';
import { queryKeys } from '@/lib/queryKeys';
import { weeklyRaceDayKey } from '@/lib/weeklyRace';
import { useAutoSubmitOnPhaseOver } from '@/lib/useAutoSubmitOnPhaseOver';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import type { SoloChallengeBundle } from '@/lib/soloChallenges';
import {
  getSoloTriesUsedToday,
  SOLO_CHALLENGE_MAX_TRIES_PER_DAY,
  tryConsumeSoloChallengeTry,
} from '@/lib/soloChallengeTries';
import type { DailyTournamentBundle } from '@/types/dailyTournamentPlay';
import type { H2hSkillContestBundle, MatchFinishPayload } from '@/types/match';

/** 60 FPS reference frame duration (ms). */
const FRAME_MS = 1000 / 60;
const GRAVITY = 0.42;
const JUMP_VY = -9.35;
const MAX_FALL_VY = 9.6;

/** Logical world — full lane is playable (no ground band). */
const LANE_H = 420;
const PLAY_H = LANE_H;

const LANE_W = 400;
const ORB_X = 78;
const ORB_VIS_R = 15.5;
const ORB_HIT_R = 11.5;
const GATE_W = 44;
const BASE_GAP_HALF = 76;
const PIPE_SCROLL_PER_MS = 0.082;

type Gate = {
  id: number;
  x: number;
  baseGapY: number;
  gapY: number;
  gapHalf: number;
  phase: number;
  amp: number;
  scored: boolean;
  scrollMul: number;
};

type PassBurst = { id: number; x: number; y: number; bornMs: number };

type GameModel = {
  orbY: number;
  orbVy: number;
  gates: Gate[];
  nextGateId: number;
  spawnAcc: number;
  spawnIntervalMs: number;
  score: number;
  streak: number;
  taps: number;
  alive: boolean;
  trail: { x: number; y: number }[];
  bursts: PassBurst[];
  nextBurstId: number;
  worldTimeMs: number;
};

function circleHitsRect(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function gateHitsOrb(gate: Gate, orbY: number): boolean {
  const g0 = gate.gapY - gate.gapHalf;
  const g1 = gate.gapY + gate.gapHalf;
  const x = gate.x;
  const bx = ORB_X;
  const by = orbY;
  const br = ORB_HIT_R;
  if (bx + br < x || bx - br > x + GATE_W) return false;
  const topH = Math.max(0, g0);
  if (topH > 0 && circleHitsRect(bx, by, br, x, 0, GATE_W, topH)) return true;
  const botY = g1;
  const botH = Math.max(0, PLAY_H - botY);
  if (botH > 0 && circleHitsRect(bx, by, br, x, botY, GATE_W, botH)) return true;
  return false;
}

function createGame(): GameModel {
  const m: GameModel = {
    orbY: PLAY_H * 0.42,
    orbVy: 0,
    gates: [],
    nextGateId: 1,
    spawnAcc: 0,
    /** Time until the *second* gate; first gate is spawned below. */
    spawnIntervalMs: 920 + Math.random() * 360,
    score: 0,
    streak: 0,
    taps: 0,
    alive: true,
    trail: [],
    bursts: [],
    nextBurstId: 1,
    worldTimeMs: 0,
  };
  spawnGate(m, { startX: STARTER_GATE_X });
  return m;
}

/** First gate sits closer so tubes are on-screen right after the first tap; later gates spawn off the right edge. */
const STARTER_GATE_X = ORB_X + 132;

function spawnGate(m: GameModel, opts?: { startX?: number }): void {
  const gapHalf = BASE_GAP_HALF - 10 + Math.random() * 28;
  const pad = ORB_HIT_R + 16;
  const lo = pad + gapHalf;
  const hi = PLAY_H - pad - gapHalf;
  const baseGapY = lo + Math.random() * Math.max(1, hi - lo);
  m.gates.push({
    id: m.nextGateId++,
    x: opts?.startX ?? LANE_W + 28,
    baseGapY,
    gapY: baseGapY,
    gapHalf,
    phase: Math.random() * Math.PI * 2,
    amp: 10 + Math.random() * 12,
    scored: false,
    scrollMul: 0.92 + Math.random() * 0.16,
  });
}

function NeonOrb({ size, vy }: { size: number; vy: number }) {
  const r = size / 2;
  const tilt = Math.max(-22, Math.min(22, vy * 2.8));
  return (
    <View
      style={[
        styles.orbGlow,
        {
          width: size + 16,
          height: size + 16,
          borderRadius: (size + 16) / 2,
          shadowOpacity: 0.85,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      <View style={{ transform: [{ rotate: `${tilt}deg` }] }}>
        <LinearGradient
          colors={['#4ADE80', '#22D3EE', '#38BDF8', '#A78BFA']}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: r,
            borderWidth: 1.5,
            borderColor: 'rgba(167, 243, 208, 0.5)',
          }}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: r,
              backgroundColor: 'rgba(255,255,255,0.22)',
              width: size * 0.38,
              height: size * 0.32,
              top: size * 0.12,
              left: size * 0.14,
            },
          ]}
        />
      </View>
    </View>
  );
}

function NeonGateColumn({
  px,
  pw,
  g0,
  g1,
  playH,
  tint,
}: {
  px: number;
  pw: number;
  g0: number;
  g1: number;
  playH: number;
  tint: 'gold' | 'violet' | 'emerald';
}) {
  const palettes = {
    gold: ['#FFD700', '#D97706', '#B45309'] as const,
    violet: ['#A78BFA', '#8B5CF6', '#5B21B6'] as const,
    emerald: ['#34D399', '#10B981', '#047857'] as const,
  };
  const edge = ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'] as const;
  const colors = palettes[tint];
  const capPad = 3;
  const capW = pw + capPad * 2;
  const capH = Math.max(7, pw * 0.28);
  const topBodyH = Math.max(0, g0 - capH);
  const botBodyH = Math.max(0, playH - g1 - capH);

  return (
    <>
      {topBodyH > 0 ? (
        <View style={[styles.gateBlock, { left: px, width: pw, height: topBodyH, top: 0 }]}>
          <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={edge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { width: 3, opacity: 0.9 }]}
          />
        </View>
      ) : null}
      <View style={[styles.gateCap, { left: px - capPad, width: capW, top: Math.max(0, g0 - capH), height: capH }]}>
        <LinearGradient colors={[...colors]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>
      <View style={[styles.gateCap, { left: px - capPad, width: capW, top: g1, height: capH }]}>
        <LinearGradient colors={[...colors]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>
      {botBodyH > 0 ? (
        <View style={[styles.gateBlock, { left: px, width: pw, height: botBodyH, top: g1 + capH }]}>
          <LinearGradient colors={[...colors]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={edge}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 0 }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 3, opacity: 0.85 }}
          />
        </View>
      ) : null}
    </>
  );
}

function GridLayer({ playW, playH, scrollPx }: { playW: number; playH: number; scrollPx: number }) {
  const cols = 9;
  const rows = 12;
  const cw = playW / cols;
  const rh = playH / rows;
  const ox = scrollPx % cw;
  const oy = (scrollPx * 0.35) % rh;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: cols + 1 }, (_, i) => (
        <View
          key={`v${i}`}
          style={[
            styles.gridLine,
            {
              left: i * cw - ox,
              height: playH,
              width: 1,
            },
          ]}
        />
      ))}
      {Array.from({ length: rows + 1 }, (_, j) => (
        <View
          key={`h${j}`}
          style={[
            styles.gridLineH,
            {
              top: j * rh - oy,
              width: playW,
              height: 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

const ParticleField = memo(function ParticleField({ seed }: { seed: number }) {
  const dots = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      key: i,
      left: ((i * 47 + seed) % 100) / 100,
      top: ((i * 73 + seed * 3) % 100) / 100,
      s: 1.2 + (i % 5) * 0.35,
      o: 0.08 + (i % 7) * 0.028,
    }));
  }, [seed]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d) => (
        <View
          key={d.key}
          style={[
            styles.particle,
            {
              left: `${d.left * 100}%`,
              top: `${d.top * 100}%`,
              width: d.s,
              height: d.s,
              opacity: d.o,
            },
          ]}
        />
      ))}
    </View>
  );
});

function PassBurstView({
  bursts,
  scale,
  nowMs,
}: {
  bursts: PassBurst[];
  scale: number;
  nowMs: number;
}) {
  return (
    <>
      {bursts
        .filter((b) => nowMs - b.bornMs <= 520)
        .map((b) => {
        const age = nowMs - b.bornMs;
        const t = age / 520;
        const px = b.x * scale;
        const py = b.y * scale;
        const a = 1 - t;
        return (
          <View key={b.id} style={[StyleSheet.absoluteFill, { zIndex: 12 }]} pointerEvents="none">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const ang = (i / 6) * Math.PI * 2 + t * 3;
              const dist = (24 + i * 7) * scale * (0.4 + t * 0.6);
              return (
                <View
                  key={i}
                  style={[
                    styles.burstDot,
                    {
                      left: px + Math.cos(ang) * dist - 2,
                      top: py + Math.sin(ang) * dist - 2,
                      opacity: a * 0.85,
                      backgroundColor: i % 2 === 0 ? '#34D399' : '#22D3EE',
                    },
                  ]}
                />
              );
            })}
            <View
              style={[
                styles.passRing,
                {
                  left: px - 28 * scale,
                  top: py - 28 * scale,
                  width: 56 * scale,
                  height: 56 * scale,
                  borderRadius: 28 * scale,
                  opacity: a * 0.55,
                  borderColor: 'rgba(52, 211, 153, 0.9)',
                },
              ]}
            />
          </View>
        );
      })}
    </>
  );
}

export type { H2hSkillContestBundle };

export default function TapDashGame({
  playMode = 'practice',
  dailyTournament,
  h2hSkillContest,
  soloChallenge,
  weeklyRace = false,
}: {
  playMode?: 'practice' | 'prize';
  dailyTournament?: DailyTournamentBundle;
  h2hSkillContest?: H2hSkillContestBundle;
  soloChallenge?: SoloChallengeBundle;
  /** Daily paid leaderboard (practice mode, no prize credits) — `?weeklyRace=1` */
  weeklyRace?: boolean;
}) {
  useHidePlayTabBar();
  const router = useRouter();
  const {
    replaceToPrimaryExit,
    replacePrimaryLabel,
    replaceToHomeTab,
    onHeaderBackPress,
  } = useMinigameExitNav();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const queryClient = useQueryClient();
  const prizeCredits = usePrizeCreditsDisplay();

  const soloAttemptsCap =
    soloChallenge?.maxAttemptsPerDay ?? SOLO_CHALLENGE_MAX_TRIES_PER_DAY;

  const { width: sw, height: sh } = useWindowDimensions();
  const laneCap = useMemo(() => minigameImmersiveStageWidth(sw), [sw]);
  const dialogCap = useMemo(() => minigameStageMaxWidth(360), [sw]);
  const [laneSize, setLaneSize] = useState(() => {
    const cap = minigameImmersiveStageWidth(sw);
    return {
      w: Math.max(200, cap),
      h: Math.max(320, Math.min(sh * 0.92, sh - 72)),
    };
  });

  const laneW = laneSize.w;
  const laneH = laneSize.h;
  const scale =
    laneW > 0 && laneH > 0 ? Math.min(laneW / LANE_W, laneH / LANE_H) : laneH / LANE_H;
  const gameW = LANE_W * scale;
  const gameH = LANE_H * scale;

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  useLockNavigatorGesturesWhile(phase === 'playing');
  const [, setUiTick] = useState(0);
  const modelRef = useRef<GameModel>(createGame());
  const lastHudEmitRef = useRef(0);
  const flapQueueRef = useRef(0);
  const startTimeRef = useRef(0);
  const endStatsRef = useRef({ score: 0, durationMs: 0, taps: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitErr, setSubmitErr] = useState(false);
  const [autoSubmitSeq, setAutoSubmitSeq] = useState(0);
  const dailyCompleteRef = useRef(false);
  const prizeRunReservationRef = useRef<string | null>(null);
  const [lastLocalAttempt, setLastLocalAttempt] = useState<LastMinigameAttempt | null>(null);
  const [soloTriesUsed, setSoloTriesUsed] = useState<number | null>(null);

  useEffect(() => {
    void loadLastMinigameAttempt().then((r) => {
      if (r?.game_type === 'tap_dash') setLastLocalAttempt(r);
    });
  }, []);

  useEffect(() => {
    if (!soloChallenge) {
      setSoloTriesUsed(null);
      return;
    }
    void getSoloTriesUsedToday(soloChallenge.challengeId).then((u) => setSoloTriesUsed(u));
  }, [soloChallenge]);

  const buildH2hBody = useCallback(() => {
    const { score, durationMs, taps } = endStatsRef.current;
    return {
      game_type: 'tap_dash' as const,
      score,
      duration_ms: durationMs,
      taps,
      match_session_id: h2hSkillContest!.matchSessionId,
    };
  }, [h2hSkillContest]);

  const { h2hSubmitPhase, h2hPoll, h2hRetryKey, setH2hRetryKey } = useH2hSkillContestSubmitAndPoll(
    h2hSkillContest,
    phase,
    buildH2hBody,
  );

  const bump = useCallback(() => setUiTick((t) => t + 1), []);

  const resetRun = useCallback(() => {
    modelRef.current = createGame();
    flapQueueRef.current = 0;
    startTimeRef.current = 0;
    setSubmitOk(false);
    setSubmitErr(false);
    setPhase('ready');
    bump();
  }, [bump]);

  const endGame = useCallback(
    (m: GameModel) => {
      m.alive = false;
      m.streak = 0;
      const durationMs = Math.max(0, Date.now() - startTimeRef.current);
      endStatsRef.current = { score: m.score, durationMs, taps: m.taps };
      if (!dailyTournament && !h2hSkillContest && playMode === 'prize' && !weeklyRace) {
        const t = ticketsFromTapDashScore(m.score);
        awardRedeemTicketsForPrizeRun(t);
      }
      setPhase('over');
      if (soloChallenge && m.score >= soloChallenge.targetScore) {
        Alert.alert(
          'Target cleared',
          `You scored ${m.score} gates (target ${soloChallenge.targetScore}). ${soloChallenge.prizeLabel} — payouts subject to eligibility and verification.`,
        );
      }
      if (!dailyTournament && !h2hSkillContest && !soloChallenge) {
        setAutoSubmitSeq((n) => n + 1);
      }
      bump();
    },
    [bump, playMode, dailyTournament, h2hSkillContest, soloChallenge, weeklyRace],
  );

  const step = useCallback(
    (totalDtMs: number) => {
      const m = modelRef.current;
      if (!m.alive) return;

      /** Substep inside one rAF callback so React Native does one render (grid/orb/background stay smooth). */
      const tick = (dtMs: number): boolean => {
        const f = Math.min(12, Math.max(0, dtMs / FRAME_MS));
        m.worldTimeMs += dtMs;
        const t = m.worldTimeMs;

        if (flapQueueRef.current > 0) {
          m.orbVy = JUMP_VY;
          m.taps += 1;
          flapQueueRef.current -= 1;
        }

        m.orbVy += GRAVITY * f;
        m.orbVy = Math.min(m.orbVy, MAX_FALL_VY);
        m.orbY += m.orbVy * f;

        if (m.orbY < ORB_HIT_R || m.orbY > PLAY_H - ORB_HIT_R) {
          endGame(m);
          return false;
        }

        const pad = ORB_HIT_R + 16;
        for (const g of m.gates) {
          const lo = pad + g.gapHalf;
          const hi = PLAY_H - pad - g.gapHalf;
          const raw = g.baseGapY + Math.sin(t * 0.00115 + g.phase) * g.amp;
          g.gapY = Math.max(lo, Math.min(hi, raw));
        }

        m.spawnAcc += dtMs;
        if (m.spawnAcc >= m.spawnIntervalMs) {
          spawnGate(m);
          m.spawnAcc = 0;
          m.spawnIntervalMs = 1480 + Math.random() * 640;
        }

        for (const g of m.gates) {
          g.x -= PIPE_SCROLL_PER_MS * g.scrollMul * dtMs;
        }
        m.gates = m.gates.filter((g) => g.x > -GATE_W - 20);

        for (const g of m.gates) {
          if (gateHitsOrb(g, m.orbY)) {
            endGame(m);
            return false;
          }
        }

        const bx = ORB_X;
        for (const g of m.gates) {
          if (!g.scored && g.x + GATE_W < bx - ORB_HIT_R) {
            g.scored = true;
            m.score += 1;
            m.streak += 1;
            m.bursts.push({
              id: m.nextBurstId++,
              x: g.x + GATE_W * 0.5,
              y: g.gapY,
              bornMs: m.worldTimeMs,
            });
          }
        }

        return true;
      };

      runFixedPhysicsSteps(totalDtMs, tick);

      if (!m.alive) return;
      const tr = m.trail;
      tr.push({ x: ORB_X, y: m.orbY });
      while (tr.length > 14) tr.shift();
      m.bursts = m.bursts.filter((b) => m.worldTimeMs - b.bornMs < 550);

      if (shouldEmitMinigameHudFrame(lastHudEmitRef, MINIGAME_HUD_MS)) {
        bump();
      }
    },
    [bump, endGame],
  );

  useRafLoop(step, phase === 'playing');

  const queueFlap = useCallback(() => {
    flapQueueRef.current = Math.min(2, flapQueueRef.current + 1);
  }, []);

  const onTap = useCallback(() => {
    if (phase === 'ready') {
      if (soloChallenge) {
        void (async () => {
          const r = await tryConsumeSoloChallengeTry(soloChallenge.challengeId);
          if (!r.ok) {
            if ('requiresWalletUnlock' in r && r.requiresWalletUnlock) {
              Alert.alert(
                'Unlock first',
                'Pay today’s wallet entry from Money Challenges, then retry while signed in.',
              );
              return;
            }
            if (r.rpcFailed) {
              Alert.alert(
                'Could not sync',
                'Check your connection and try again. Your try count is verified on the server when you’re signed in.',
              );
              return;
            }
            Alert.alert(
              'Daily limit',
              `You’ve used all ${soloAttemptsCap} tries today for this challenge. New tries after local midnight.`,
            );
            return;
          }
          setSoloTriesUsed(r.usedAfter);
          modelRef.current = createGame();
          startTimeRef.current = Date.now();
          modelRef.current.worldTimeMs = 0;
          setSubmitOk(false);
          setSubmitErr(false);
          setPhase('playing');
          resetMinigameHudClock(lastHudEmitRef);
          queueFlap();
          bump();
        })();
        return;
      }
      if (!dailyTournament && !h2hSkillContest && playMode === 'prize' && !weeklyRace) {
        void (async () => {
          if (ENABLE_BACKEND) {
            if (!assertBackendPrizeSignedIn(ENABLE_BACKEND, uid)) return;
            const r = await beginMinigamePrizeRun('tap_dash');
            if (!r.ok) {
              if (r.error === 'insufficient_credits') {
                alertInsufficientPrizeCredits(
                  router,
                  `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free. Earn credits by winning prize runs.`,
                );
              } else {
                Alert.alert('Could not start prize run', r.message ?? 'Try again.');
              }
              return;
            }
            prizeRunReservationRef.current = r.reservationId;
            if (uid) invalidateProfileEconomy(queryClient, uid);
          } else {
            const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits);
            if (!ok) {
              alertInsufficientPrizeCredits(
                router,
                `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free. Earn credits by winning prize runs.`,
              );
              return;
            }
          }
          modelRef.current = createGame();
          startTimeRef.current = Date.now();
          modelRef.current.worldTimeMs = 0;
          setSubmitOk(false);
          setSubmitErr(false);
          setPhase('playing');
          resetMinigameHudClock(lastHudEmitRef);
          queueFlap();
          bump();
        })();
        return;
      }
      modelRef.current = createGame();
      startTimeRef.current = Date.now();
      modelRef.current.worldTimeMs = 0;
      setSubmitOk(false);
      setSubmitErr(false);
      setPhase('playing');
      resetMinigameHudClock(lastHudEmitRef);
      queueFlap();
      bump();
      return;
    }
    if (phase === 'playing') {
      queueFlap();
    }
  }, [
    phase,
    bump,
    queueFlap,
    playMode,
    profileQ.data?.prize_credits,
    dailyTournament,
    h2hSkillContest,
    router,
    queryClient,
    uid,
    soloChallenge,
    soloAttemptsCap,
    weeklyRace,
  ]);

  /** Same controls as in-play (Space / ↑): start from ready, flap while playing — web only. */
  useWebGameKeyboard(phase === 'playing' || phase === 'ready', {
    Space: (down) => {
      if (down) onTap();
    },
    ArrowUp: (down) => {
      if (down) onTap();
    },
  });

  const submitScore = useCallback(async () => {
    const { score, durationMs, taps } = endStatsRef.current;
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
      const prizeRun = playMode === 'prize' && !dailyTournament && !h2hSkillContest && !weeklyRace;
      if (!assertPrizeRunReservation(prizeRun, ENABLE_BACKEND, prizeRunReservationRef.current)) {
        setSubmitErr(true);
        return;
      }
      const body: Record<string, unknown> = {
        game_type: 'tap_dash' as const,
        score,
        duration_ms: durationMs,
        taps,
      };
      if (prizeRun && ENABLE_BACKEND) {
        body.prize_run = true;
        body.prize_run_reservation_id = prizeRunReservationRef.current!;
      }
      const { error } = await invokeEdgeFunction('submitMinigameScore', { body });
      if (error) {
        await saveLastMinigameAttempt({
          game_type: 'tap_dash',
          score,
          duration_ms: durationMs,
          taps,
          errorMessage: error.message ?? 'submit_failed',
        });
        setLastLocalAttempt(await loadLastMinigameAttempt());
        Alert.alert('Submit failed', error.message ?? 'Could not reach server. Your score is saved on this device — tap Retry.');
        setSubmitErr(true);
        return;
      }
      await clearLastMinigameAttempt();
      setLastLocalAttempt(null);
      invalidateProfileEconomy(queryClient, uid);
      setSubmitOk(true);
      if (weeklyRace) {
        void (async () => {
          const ok = await onWeeklyRaceAfterMinigameScore('tap-dash', endStatsRef.current.score);
          if (ok) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.weeklyRace(weeklyRaceDayKey()) });
          }
        })();
      }
    } finally {
      setSubmitting(false);
    }
  }, [playMode, dailyTournament, h2hSkillContest, queryClient, uid, weeklyRace]);

  useAutoSubmitOnPhaseOver({
    phase,
    overValue: 'over',
    runToken: autoSubmitSeq,
    disabled: Boolean(dailyTournament || h2hSkillContest || soloChallenge),
    onSubmit: submitScore,
  });

  const m = modelRef.current;
  const orbSize = ORB_VIS_R * scale * 2;
  const scrollPx = (m.worldTimeMs * 0.024) % 200;
  const tintAt = (id: number) => (['gold', 'violet', 'emerald'] as const)[id % 3];

  const dailyPayload =
    dailyTournament && phase === 'over'
      ? finalizeDailyScores(
          endStatsRef.current.score,
          dailyTournament.opponentRoundScore,
          dailyTournament.forcedOutcome,
          dailyTournament.localPlayerId,
          dailyTournament.opponentId,
          dailyTournament.scoreVarianceKey,
        )
      : null;

  const onContinueDaily = useCallback(() => {
    if (!dailyTournament || !dailyPayload || dailyCompleteRef.current) return;
    dailyCompleteRef.current = true;
    dailyTournament.onComplete(dailyPayload);
  }, [dailyTournament, dailyPayload]);

  /** Web: game over — Space / ↑ / Enter = Play Again or (daily) Continue. H2H waits on server — no shortcut. */
  useWebGameKeyboard(
    Platform.OS === 'web' && phase === 'over' && !h2hSkillContest && (!dailyTournament || !!dailyPayload),
    {
      Space: (down) => {
        if (!down) return;
        if (dailyTournament) onContinueDaily();
        else resetRun();
      },
      ArrowUp: (down) => {
        if (!down) return;
        if (dailyTournament) onContinueDaily();
        else resetRun();
      },
      Enter: (down) => {
        if (!down) return;
        if (dailyTournament) onContinueDaily();
        else resetRun();
      },
    },
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={onHeaderBackPress}
            style={styles.topIconBtn}
          >
            <SafeIonicons name="chevron-back" size={26} color="rgba(226,232,240,0.95)" />
          </Pressable>
          <View style={styles.scoreColumn}>
            <Text style={styles.scoreText}>{m.score}</Text>
            {phase === 'playing' && m.streak >= 2 ? (
              <Text style={styles.streakText}>x{m.streak} streak</Text>
            ) : (
              <Text style={styles.streakPlaceholder}> </Text>
            )}
            {(dailyTournament || h2hSkillContest) && phase !== 'over' ? (
              <Text style={styles.vsOppLabel} numberOfLines={1}>
                vs {dailyTournament?.opponentDisplayName ?? h2hSkillContest?.opponentDisplayName}
              </Text>
            ) : null}
          </View>
          {dailyTournament || h2hSkillContest ? (
            <View style={styles.topBarRightSpacer} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buy arcade credits"
              onPress={() => pushArcadeCreditsShop(router)}
              style={({ pressed }) => [styles.creditsPill, pressed && { opacity: 0.88 }]}
            >
              <View style={{ marginRight: 4 }}>
                <SafeIonicons name="gift-outline" size={16} color="#5EEAD4" />
              </View>
              <Text style={styles.creditsText}>{prizeCredits.toLocaleString()}</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.pressFlex} onPressIn={onTap} disabled={phase === 'over'}>
          <View
            style={[styles.lane, { maxWidth: laneCap }]}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) setLaneSize({ w: width, h: height });
            }}
          >
            <View style={styles.laneCenter}>
              <View style={[styles.laneStage, { width: gameW, height: gameH }]}>
                <LinearGradient
                  colors={['#070B14', '#0B1220', '#020617']}
                  locations={[0, 0.45, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <ParticleField seed={42} />
                <GridLayer playW={gameW} playH={gameH} scrollPx={scrollPx} />

                <View style={[styles.playSlice, { height: gameH, width: gameW }]}>
              {m.gates.map((g) => {
                const px = g.x * scale;
                const pw = GATE_W * scale;
                const g0 = (g.gapY - g.gapHalf) * scale;
                const g1 = (g.gapY + g.gapHalf) * scale;
                return (
                  <View key={g.id} style={StyleSheet.absoluteFill} pointerEvents="none">
                    <NeonGateColumn px={px} pw={pw} g0={g0} g1={g1} playH={gameH} tint={tintAt(g.id)} />
                  </View>
                );
              })}

              {m.trail.map((p, i) => {
                const age = m.trail.length - i;
                const a = 0.08 + (age / m.trail.length) * 0.32;
                const s = (ORB_VIS_R * 0.35 + (age / m.trail.length) * ORB_VIS_R * 0.5) * scale * 2;
                return (
                  <View
                    key={`t${i}`}
                    style={[
                      styles.trailDot,
                      {
                        left: p.x * scale - s / 2,
                        top: p.y * scale - s / 2,
                        width: s,
                        height: s,
                        borderRadius: s / 2,
                        opacity: a,
                      },
                    ]}
                  />
                );
              })}

              <PassBurstView bursts={m.bursts} scale={scale} nowMs={m.worldTimeMs} />

              <View
                style={[
                  styles.orbWrap,
                  {
                    left: ORB_X * scale - ORB_VIS_R * scale,
                    top: m.orbY * scale - ORB_VIS_R * scale,
                  },
                ]}
              >
                <NeonOrb size={orbSize} vy={m.orbVy} />
              </View>
            </View>

                <LinearGradient
                  colors={['rgba(255,215,0,0.12)', 'transparent', 'rgba(167,139,250,0.1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, styles.vignette]}
                  pointerEvents="none"
                />
              </View>
            </View>
          </View>

          {phase === 'ready' ? (
            <View style={styles.hint} pointerEvents="none">
              <Text style={styles.hintBrand}>TAP DASH</Text>
              <Text style={styles.hintMode}>
                {soloChallenge
                  ? `Solo challenge · reach ${soloChallenge.targetScore} gates · ${soloChallenge.prizeLabel} showcase`
                  : h2hSkillContest
                    ? `Head-to-head · vs ${h2hSkillContest.opponentDisplayName} · server-validated score`
                    : dailyTournament
                      ? `Live event · vs ${dailyTournament.opponentDisplayName}`
                      : playMode === 'prize'
                        ? `Prize run · ${PRIZE_RUN_ENTRY_CREDITS} credits · +1 ticket per ${TAP_DASH_POINTS_PER_TICKET} score`
                        : 'Practice · free · no credits spent'}
              </Text>
              {soloChallenge ? (
                <Text style={styles.hintSub}>
                  Tries today: {soloTriesUsed ?? '…'}/{soloAttemptsCap} · Money Challenge (Money tab)
                </Text>
              ) : (
                <Text style={styles.hintSub}>Neon sprint · precision run</Text>
              )}
              <Text style={styles.hintBody}>
                {Platform.OS === 'web' ? 'Tap or Space / ↑ to thrust · thread the gates' : 'Tap to thrust · thread the gates'}
              </Text>
              <Text style={styles.hintCta}>
                {Platform.OS === 'web' ? 'Tap, Space, or ↑ to start' : 'Tap to start'}
              </Text>
            </View>
          ) : null}
        </Pressable>

        {phase === 'over' && dailyTournament && dailyPayload ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={[styles.card, { maxWidth: dialogCap }]}>
              <GameOverExitRow
                minigamesLabel={replacePrimaryLabel}
                onMinigames={replaceToPrimaryExit}
                onHome={replaceToHomeTab}
              />
              <Text style={styles.goTitle}>Round result</Text>
              <Text style={styles.goVs} numberOfLines={1}>
                You vs {dailyTournament.opponentDisplayName}
              </Text>
              <Text style={styles.goScore}>
                {dailyPayload.finalScore.self} — {dailyPayload.finalScore.opponent}
              </Text>
              <Text style={styles.practiceNote}>
                {dailyPayload.winnerId === dailyTournament.localPlayerId
                  ? 'You take the match and move on.'
                  : 'They take the match — you’re out of today’s event.'}
              </Text>
              <AppButton title="Continue" onPress={onContinueDaily} />
            </View>
          </View>
        ) : null}
        {phase === 'over' && h2hSkillContest ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={[styles.card, { maxWidth: dialogCap }]}>
              <GameOverExitRow
                minigamesLabel={replacePrimaryLabel}
                onMinigames={replaceToPrimaryExit}
                onHome={replaceToHomeTab}
              />
              <Text style={styles.goTitle}>Run ended</Text>
              <Text style={styles.goScore}>Your gates: {endStatsRef.current.score}</Text>
              {h2hSubmitPhase === 'loading' ? (
                <Text style={styles.practiceNote}>Submitting your run…</Text>
              ) : null}
              {h2hSubmitPhase === 'error' ? (
                <>
                  <Text style={styles.practiceNote}>Could not submit this run. Check your connection.</Text>
                  <AppButton
                    title="Retry submit"
                    className="mt-3"
                    onPress={() => setH2hRetryKey((k) => k + 1)}
                  />
                </>
              ) : null}
              {h2hSubmitPhase === 'ok' && !h2hPoll?.both_submitted ? (
                <Text style={styles.practiceNote}>
                  Waiting for {h2hSkillContest.opponentDisplayName} to finish…
                </Text>
              ) : null}
              {h2hSubmitPhase === 'ok' && h2hPoll?.both_submitted ? (
                <Text style={styles.practiceNote}>Both runs in — finalizing match…</Text>
              ) : null}
            </View>
          </View>
        ) : null}
        {phase === 'over' && !dailyTournament && !h2hSkillContest ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={[styles.card, { maxWidth: dialogCap }]}>
              <GameOverExitRow
                minigamesLabel={replacePrimaryLabel}
                onMinigames={replaceToPrimaryExit}
                onHome={replaceToHomeTab}
              />
              <Text style={styles.goTitle}>Run ended</Text>
              {soloChallenge ? (
                <Text style={styles.goVs} numberOfLines={2}>
                  Challenge target: {soloChallenge.targetScore} gates · {soloChallenge.prizeLabel}
                </Text>
              ) : null}
              <Text style={styles.goScore}>Score: {endStatsRef.current.score}</Text>
              {soloChallenge ? (
                <Text style={styles.practiceNote}>
                  {endStatsRef.current.score >= soloChallenge.targetScore
                    ? 'Target met — eligibility for showcase prizes is verified separately.'
                    : 'Target not met — try again while you have daily tries.'}
                </Text>
              ) : null}
              {playMode === 'prize' && !soloChallenge ? (
                <Text style={styles.goTickets}>
                  +{ticketsFromTapDashScore(endStatsRef.current.score)} redeem tickets (this run)
                </Text>
              ) : null}
              <AppButton title="Play Again" onPress={resetRun} className="mb-3" />
              {soloChallenge ? null : playMode === 'prize' ? (
                <>
                  {submitting ? (
                    <>
                      <Text style={styles.practiceNote}>Saving score…</Text>
                      <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
                    </>
                  ) : null}
                  {submitOk ? <Text style={styles.practiceNote}>Score saved.</Text> : null}
                  {submitErr && !submitting ? (
                    <>
                      <Text style={styles.practiceNote}>Could not save score. Check your connection.</Text>
                      {lastLocalAttempt?.game_type === 'tap_dash' ? (
                        <Text style={styles.practiceNote}>
                          On-device backup: score {lastLocalAttempt.score} — Retry resubmits this run.
                        </Text>
                      ) : null}
                      <AppButton
                        title="Retry"
                        variant="secondary"
                        className="mt-2"
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
                      <Text style={styles.practiceNote}>Saving practice run…</Text>
                      <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
                    </>
                  ) : null}
                  {submitOk ? (
                    <Text style={styles.practiceNote}>Practice run saved (no prize tickets).</Text>
                  ) : null}
                  {submitErr && !submitting ? (
                    <>
                      <Text style={styles.practiceNote}>Could not save run.</Text>
                      {lastLocalAttempt?.game_type === 'tap_dash' ? (
                        <Text style={styles.practiceNote}>
                          On-device backup: score {lastLocalAttempt.score} — Retry resubmits this run.
                        </Text>
                      ) : null}
                      <AppButton
                        title="Retry"
                        variant="secondary"
                        className="mt-2"
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
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: runit.bgDeep },
  root: { flex: 1, width: '100%' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 8,
    zIndex: 30,
  },
  topIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRightSpacer: { width: 72, height: 36 },
  vsOppLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(226,232,240,0.7)',
    marginTop: 2,
    maxWidth: 280,
    textAlign: 'center',
  },
  scoreColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scoreText: {
    color: '#F8FAFC',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(255, 215, 0, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  streakText: {
    marginTop: 2,
    color: 'rgba(52, 211, 153, 0.95)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  streakPlaceholder: {
    marginTop: 2,
    fontSize: 12,
    opacity: 0,
  },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(94, 234, 212, 0.35)',
    minWidth: 72,
    justifyContent: 'center',
  },
  creditsText: {
    color: 'rgba(226, 232, 240, 0.95)',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pressFlex: { flex: 1, width: '100%', alignItems: 'center' },
  lane: {
    flex: 1,
    width: '100%',
    minHeight: 280,
    alignSelf: 'center',
  },
  laneCenter: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  laneStage: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  playSlice: {
    width: '100%',
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(56, 189, 248, 0.07)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    backgroundColor: 'rgba(167, 139, 250, 0.06)',
  },
  particle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(226, 232, 240, 0.35)',
  },
  gateBlock: {
    position: 'absolute',
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  gateCap: {
    position: 'absolute',
    borderRadius: 5,
    overflow: 'hidden',
    shadowColor: '#A78BFA',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  trailDot: {
    position: 'absolute',
    backgroundColor: 'rgba(52, 211, 153, 0.65)',
    zIndex: 8,
  },
  burstDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  passRing: {
    position: 'absolute',
    borderWidth: 2,
    zIndex: 11,
  },
  orbWrap: {
    position: 'absolute',
    zIndex: 16,
  },
  orbGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34D399',
  },
  vignette: { opacity: 0.9 },
  hint: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(2, 6, 15, 0.55)',
  },
  hintBrand: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 6,
    textShadowColor: 'rgba(255, 215, 0, 0.6)',
    textShadowRadius: 14,
  },
  hintMode: {
    color: 'rgba(253, 224, 71, 0.95)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  hintSub: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  hintBody: {
    color: 'rgba(226, 232, 240, 0.9)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  hintCta: {
    color: '#5EEAD4',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 50,
  },
  card: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    backgroundColor: 'rgba(10, 15, 28, 0.98)',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  goTitle: {
    color: arcade.white,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  goVs: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  goScore: {
    color: arcade.textMuted,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  goTickets: {
    color: '#FDE047',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  practiceNote: {
    marginTop: 8,
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
