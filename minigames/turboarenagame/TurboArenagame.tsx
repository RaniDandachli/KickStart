// ─────────────────────────────────────────────
//  TurboArenaGame.tsx  –  single-player / prize-run mode
//  Mirrors TapDashGame.tsx conventions exactly
// ─────────────────────────────────────────────

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { consumePrizeRunEntryCredits, TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { alertInsufficientPrizeCredits, pushArcadeCreditsShop } from '@/lib/arcadeCreditsShop';
import { arcade } from '@/lib/arcadeTheme';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { useAutoSubmitOnPhaseOver } from '@/lib/useAutoSubmitOnPhaseOver';
import { getSupabase } from '@/supabase/client';
import {
  MINIGAME_HUD_MS_MOTION,
  resetMinigameHudClock,
  shouldEmitMinigameHudFrame,
} from '@/minigames/core/minigameHudThrottle';
import { useRafLoop } from '@/minigames/core/useRafLoop';
import { GameOverExitRow, ROUTE_HOME, ROUTE_MINIGAMES } from '@/minigames/ui/GameOverExitRow';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { minigameImmersiveStageWidth, minigameStageMaxWidth } from '@/minigames/ui/minigameWebMaxWidth';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { useAuthStore } from '@/store/authStore';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useProfile } from '@/hooks/useProfile';
import type { H2hSkillContestBundle } from '@/types/match';

import {
  AiDifficulty,
  createTurboArenaState,
  spawnParticles,
  stepTurboArena,
  TURBO,
  type TurboArenaState,
  type TurboInputs,
} from './TurboArenaEngine';

// ── Scoring for prize runs ─────────────────────
// 1 ticket per 3 goals scored
const TURBO_POINTS_PER_TICKET = 3;
function ticketsFromTurboScore(score: number) {
  return Math.floor(score / TURBO_POINTS_PER_TICKET);
}

// ── Scale ─────────────────────────────────────

function useArenaScale(sw: number) {
  const cap = minigameImmersiveStageWidth(sw);
  const maxW = Math.min(sw - 16, cap);
  const scale = maxW / TURBO.worldW;
  return { scale, arenaW: TURBO.worldW * scale, arenaH: TURBO.worldH * scale };
}

// ── Sub-components (reused from Screen, self-contained here) ──

function RetroGrid({ arenaW, groundY }: { arenaW: number; groundY: number }) {
  const vanishX = arenaW / 2;
  const vanishY = groundY * 0.55;
  const cols = 12;
  const rows = 7;
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <LinearGradient
        colors={['#10003a', '#06001a']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: vanishY, left: 0, right: 0, height: groundY - vanishY }}
      />
      {Array.from({ length: cols + 1 }, (_, i) => {
        const bx = (arenaW / cols) * i;
        const angle = Math.atan2(bx - vanishX, groundY - vanishY);
        const len = Math.sqrt(Math.pow(bx - vanishX, 2) + Math.pow(groundY - vanishY, 2));
        return (
          <View
            key={`v${i}`}
            style={{
              position: 'absolute',
              left: vanishX,
              top: vanishY,
              width: 1,
              height: len,
              backgroundColor: 'rgba(180,0,255,0.18)',
              transformOrigin: 'top',
              transform: [{ rotate: `${angle}rad` }],
            }}
          />
        );
      })}
      {Array.from({ length: rows }, (_, j) => {
        const t = (j + 1) / rows;
        const ly = vanishY + (groundY - vanishY) * t;
        const lw = arenaW * t;
        return (
          <View
            key={`h${j}`}
            style={{
              position: 'absolute',
              left: vanishX - lw / 2,
              top: ly,
              width: lw,
              height: 1,
              backgroundColor: 'rgba(180,0,255,0.18)',
            }}
          />
        );
      })}
    </View>
  );
}

function ArenaCanvas({
  state,
  scale,
  arenaW,
  arenaH,
}: {
  state: TurboArenaState;
  scale: number;
  arenaW: number;
  arenaH: number;
}) {
  const { player, cpu, ball } = state;
  const groundY = TURBO.groundY * scale;
  const goalH = TURBO.goalH * scale;
  const goalW = TURBO.goalW * scale;
  const goalY = TURBO.goalY * scale;
  const carW = TURBO.carW * scale;
  const carH = TURBO.carH * scale;
  const ballR = TURBO.ballR * scale;
  const wheelR = carH * 0.28;

  return (
    <View style={[styles.arena, { width: arenaW, height: arenaH }]}>
      <LinearGradient
        colors={['#02001a', '#0a0030', '#1a0040']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <RetroGrid arenaW={arenaW} groundY={groundY} />

      {/* Ground */}
      <View style={{ position: 'absolute', top: groundY, left: 0, right: 0, height: arenaH - groundY, backgroundColor: '#06001a' }} />
      <View style={[styles.groundLine, { top: groundY, width: arenaW }]} />

      {/* Goals */}
      {[
        { left: 0, color: '#ff6600', bg: 'rgba(255,102,0,0.12)' },
        { left: arenaW - goalW, color: '#0088ff', bg: 'rgba(0,136,255,0.12)' },
      ].map((g, i) => (
        <View
          key={i}
          style={[styles.goal, {
            left: g.left, top: goalY,
            width: goalW, height: goalH,
            borderColor: g.color, backgroundColor: g.bg,
            shadowColor: g.color,
          }]}
        />
      ))}

      {/* Center dash */}
      <View style={[styles.centerLine, { left: arenaW / 2, height: groundY }]} />

      {/* Particles */}
      {state.particles.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: p.x * scale - p.r,
            top: p.y * scale - p.r,
            width: p.r * 2, height: p.r * 2,
            borderRadius: p.r,
            backgroundColor: p.color,
            opacity: p.life,
            shadowColor: p.glow ? p.color : undefined,
            shadowOpacity: p.glow ? 0.9 : 0,
            shadowRadius: p.glow ? 6 : 0,
          }}
        />
      ))}

      {/* Ball trail */}
      {ball.trail.map((pt, i) => {
        const s = ballR * (i / ball.trail.length) * 0.7;
        return (
          <View key={`bt${i}`} style={{
            position: 'absolute',
            left: pt.x * scale - s, top: pt.y * scale - s,
            width: s * 2, height: s * 2, borderRadius: s,
            backgroundColor: '#aaffff',
            opacity: (i / ball.trail.length) * 0.25,
          }} />
        );
      })}

      {/* Ball */}
      <View style={{
        position: 'absolute',
        left: ball.x * scale - ballR, top: ball.y * scale - ballR,
        width: ballR * 2, height: ballR * 2, borderRadius: ballR,
        overflow: 'hidden',
        shadowColor: '#aaffff', shadowOpacity: 0.6, shadowRadius: 10, elevation: 6,
      }}>
        <LinearGradient
          colors={['#eeffff', '#88ccff', '#003388']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.9, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: ballR }]}
        />
        <View style={{
          position: 'absolute', borderRadius: ballR * 0.25,
          backgroundColor: 'rgba(255,255,255,0.45)',
          width: ballR * 0.5, height: ballR * 0.4,
          top: ballR * 0.2, left: ballR * 0.2,
        }} />
      </View>

      {/* Cars */}
      {[player, cpu].map((car, ci) => {
        const isP = ci === 0;
        const color = isP ? '#ff6600' : '#0088ff';
        const accent = isP ? '#ffcc00' : '#00ffff';
        return (
          <View
            key={ci}
            style={{
              position: 'absolute',
              left: car.x * scale, top: car.y * scale,
              width: carW, height: carH,
              transform: car.flipped ? [{ scaleX: -1 }] : [],
            }}
          >
            {car.isBoosting && (
              <LinearGradient
                colors={[isP ? '#ffdd00' : '#00aaff', 'transparent']}
                start={{ x: 1, y: 0.5 }} end={{ x: 0, y: 0.5 }}
                style={{ position: 'absolute', left: -18, top: '32%', width: carW * 0.55, height: carH * 0.35, borderRadius: 4, opacity: 0.85 }}
              />
            )}
            <LinearGradient
              colors={[accent, color, '#111']}
              locations={[0, 0.4, 1]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={{
                flex: 1, borderRadius: carH * 0.18, overflow: 'hidden',
                shadowColor: color, shadowOpacity: 0.6, shadowRadius: 10, elevation: 5,
              }}
            >
              <View style={{ position: 'absolute', width: carW * 0.38, height: carH * 0.42, top: carH * 0.06, right: carW * 0.1, borderRadius: carH * 0.1, backgroundColor: 'rgba(160,220,255,0.72)' }} />
              <View style={{ position: 'absolute', left: '10%', right: '10%', top: carH * 0.6, height: carH * 0.1, backgroundColor: accent, opacity: 0.7 }} />
            </LinearGradient>
            {[carW * 0.22, carW * 0.78].map((wx, wi) => (
              <View key={wi} style={{
                position: 'absolute',
                left: wx - wheelR, top: carH - wheelR * 0.8,
                width: wheelR * 2, height: wheelR * 2, borderRadius: wheelR,
                backgroundColor: '#222', borderWidth: 2, borderColor: accent,
                shadowColor: accent, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4,
              }} />
            ))}
          </View>
        );
      })}

      {/* Goal flash */}
      {state.goalFlash ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,10,0.72)', alignItems: 'center', justifyContent: 'center', zIndex: 50 }]}>
          <Text style={{ fontSize: 42, fontWeight: '900', letterSpacing: 8, color: '#ffff00', textShadowColor: '#ff8800', textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } }}>GOAL!</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 4, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
            {state.goalFlash.scorer === 1 ? 'YOU score' : 'CPU scores'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Main component ─────────────────────────────

export default function TurboArenaGame({
  playMode = 'practice',
  h2hSkillContest,
}: {
  playMode?: 'practice' | 'prize';
  h2hSkillContest?: H2hSkillContestBundle;
}) {
  useHidePlayTabBar();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const profileQ = useProfile(uid);
  const prizeCredits = usePrizeCreditsDisplay();

  const { width: sw } = useWindowDimensions();
  const dialogMax = useMemo(() => minigameStageMaxWidth(360), [sw]);
  const { scale, arenaW, arenaH } = useArenaScale(sw);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const [difficulty] = useState<AiDifficulty>('medium');
  const [, setUiTick] = useState(0);

  const stateRef = useRef<TurboArenaState | null>(null);
  const inputsRef = useRef<TurboInputs>({
    left: false, right: false, jump: false, boost: false, kick: false,
  });
  const startTimeRef = useRef(0);
  const endStatsRef = useRef({ scoreP1: 0, durationMs: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitErr, setSubmitErr] = useState(false);
  const [autoSubmitSeq, setAutoSubmitSeq] = useState(0);
  const lastHudEmitRef = useRef(0);
  const prizeRunReservationRef = useRef<string | null>(null);

  const bump = useCallback(() => setUiTick((t) => t + 1), []);

  const resetRun = useCallback(() => {
    stateRef.current = null;
    resetMinigameHudClock(lastHudEmitRef);
    setSubmitOk(false);
    setSubmitErr(false);
    setPhase('ready');
    bump();
  }, [bump]);

  const endGame = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    endStatsRef.current = {
      scoreP1: s.scoreP1,
      durationMs: Math.max(0, Date.now() - startTimeRef.current),
    };
    setPhase('over');
    if (!h2hSkillContest) {
      setAutoSubmitSeq((n) => n + 1);
    }
    bump();
  }, [bump, h2hSkillContest]);

  const step = useCallback(
    (dtMs: number) => {
      const s = stateRef.current;
      if (!s) return;
      stepTurboArena(s, dtMs, inputsRef.current, difficulty);
      // Consume one-shot jump after it's been processed
      if (inputsRef.current.jump) {
        inputsRef.current = { ...inputsRef.current, jump: false };
      }
      if (s.timeLeftMs <= 0) {
        endGame();
        return;
      }
      if (shouldEmitMinigameHudFrame(lastHudEmitRef, MINIGAME_HUD_MS_MOTION)) bump();
    },
    [bump, difficulty, endGame],
  );

  useRafLoop(step, phase === 'playing');

  const buildH2hBody = useCallback(() => {
    const { scoreP1, durationMs } = endStatsRef.current;
    return {
      game_type: 'turbo_arena' as const,
      score: scoreP1,
      duration_ms: durationMs,
      taps: 0,
      match_session_id: h2hSkillContest!.matchSessionId,
    };
  }, [h2hSkillContest]);

  const { h2hSubmitPhase, h2hPoll, setH2hRetryKey } = useH2hSkillContestSubmitAndPoll(
    h2hSkillContest,
    phase,
    buildH2hBody,
  );

  const startGame = useCallback(() => {
    void (async () => {
      if (!h2hSkillContest && playMode === 'prize') {
        if (ENABLE_BACKEND) {
          if (!assertBackendPrizeSignedIn(ENABLE_BACKEND, uid)) return;
          const r = await beginMinigamePrizeRun('turbo_arena');
          if (!r.ok) {
            if (r.error === 'insufficient_credits') {
              alertInsufficientPrizeCredits(
                router,
                `Turbo Arena prize runs cost ${TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
              );
            } else {
              Alert.alert('Could not start prize run', r.message ?? 'Try again.');
            }
            return;
          }
          prizeRunReservationRef.current = r.reservationId;
          if (uid) invalidateProfileEconomy(queryClient, uid);
        } else {
          const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits, TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS);
          if (!ok) {
            alertInsufficientPrizeCredits(
              router,
              `Turbo Arena prize runs cost ${TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
            );
            return;
          }
        }
      }
      stateRef.current = createTurboArenaState();
      startTimeRef.current = Date.now();
      resetMinigameHudClock(lastHudEmitRef);
      setSubmitOk(false);
      setSubmitErr(false);
      setPhase('playing');
      bump();
    })();
  }, [playMode, profileQ.data?.prize_credits, bump, h2hSkillContest, router, queryClient, uid]);

  const submitScore = useCallback(async () => {
    const { scoreP1, durationMs } = endStatsRef.current;
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
      const prizeRun = playMode === 'prize' && !h2hSkillContest;
      if (!assertPrizeRunReservation(prizeRun, ENABLE_BACKEND, prizeRunReservationRef.current)) {
        setSubmitErr(true);
        return;
      }
      const body: Record<string, unknown> = {
        game_type: 'turbo_arena' as const,
        score: scoreP1,
        duration_ms: durationMs,
        taps: 0,
      };
      if (prizeRun && ENABLE_BACKEND) {
        body.prize_run = true;
        body.prize_run_reservation_id = prizeRunReservationRef.current!;
      }
      const { error } = await invokeEdgeFunction('submitMinigameScore', { body });
      if (error) {
        Alert.alert('Submit failed', error.message ?? 'Could not reach server.');
        setSubmitErr(true);
        return;
      }
      invalidateProfileEconomy(queryClient, uid);
      setSubmitOk(true);
    } finally {
      setSubmitting(false);
    }
  }, [playMode, h2hSkillContest, queryClient, uid]);

  useAutoSubmitOnPhaseOver({
    phase,
    overValue: 'over',
    runToken: autoSubmitSeq,
    disabled: Boolean(h2hSkillContest),
    onSubmit: submitScore,
  });

  const s = stateRef.current;

  // ── Controls helpers ──
  const setKey = (key: keyof TurboInputs, val: boolean) => {
    if (key === 'jump' && val) {
      inputsRef.current = { ...inputsRef.current, jump: true };
    } else if (key === 'kick' && val) {
      inputsRef.current = { ...inputsRef.current, kick: true };
      setTimeout(() => { inputsRef.current = { ...inputsRef.current, kick: false }; }, 80);
    } else {
      inputsRef.current = { ...inputsRef.current, [key]: val };
    }
  };

  useWebGameKeyboard(phase === 'playing', {
    ArrowLeft: (d) => setKey('left', d),
    ArrowRight: (d) => setKey('right', d),
    ArrowUp: (d) => {
      if (d) setKey('jump', true);
      else setKey('jump', false);
    },
    Space: (d) => {
      if (d) setKey('jump', true);
      else setKey('jump', false);
    },
    ShiftLeft: (d) => setKey('boost', d),
    ShiftRight: (d) => setKey('boost', d),
    KeyX: (d) => setKey('kick', d),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.root}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <SafeIonicons name="chevron-back" size={26} color="rgba(226,232,240,0.95)" />
          </Pressable>
          <View style={styles.scoreCol}>
            <Text style={styles.scoreYou}>{s?.scoreP1 ?? 0}</Text>
            <Text style={styles.scoreSep}>:</Text>
            <Text style={styles.scoreCpu}>{s?.scoreP2 ?? 0}</Text>
            {h2hSkillContest && phase !== 'over' ? (
              <Text style={styles.vsH2h} numberOfLines={1}>
                vs {h2hSkillContest.opponentDisplayName}
              </Text>
            ) : null}
          </View>
          {h2hSkillContest ? (
            <View style={{ width: 72 }} />
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

        {/* Timer */}
        {s && phase === 'playing' && (
          <Text style={styles.timer}>
            {Math.floor(s.timeLeftMs / 60000)}:
            {String(Math.floor((s.timeLeftMs % 60000) / 1000)).padStart(2, '0')}
          </Text>
        )}

        {/* Arena */}
        <View style={styles.arenaWrap}>
          {s ? (
            <ArenaCanvas state={s} scale={scale} arenaW={arenaW} arenaH={arenaH} />
          ) : (
            // Blank field preview on ready screen
            <View style={[styles.arena, { width: arenaW, height: arenaH }]}>
              <LinearGradient
                colors={['#02001a', '#0a0030', '#1a0040']}
                style={StyleSheet.absoluteFill}
              />
            </View>
          )}
        </View>

        {/* Ready overlay */}
        {phase === 'ready' && (
          <View style={styles.readyOverlay}>
            <Text style={styles.readyTitle}>TURBO ARENA</Text>
            <Text style={styles.readyMode}>
              {h2hSkillContest
                ? `Head-to-head · vs ${h2hSkillContest.opponentDisplayName} · goals vs CPU, score vs human`
                : playMode === 'prize'
                  ? `Prize run · ${TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS} credits`
                  : 'Practice · free'}
            </Text>
            <Text style={styles.readyHint}>
              Score more goals than the CPU in 2 minutes
              {Platform.OS === 'web'
                ? '\nWeb: ← → move · Space/↑ jump · Shift boost · X kick'
                : ''}
            </Text>
            <AppButton title="▶  START" onPress={startGame} />
          </View>
        )}

        {/* Controls */}
        {phase === 'playing' && (
          <View style={styles.controlsRow}>
            {/* D-pad */}
            <View style={styles.dpad}>
              <Pressable
                style={styles.dpadBtn}
                onPressIn={() => setKey('left', true)}
                onPressOut={() => setKey('left', false)}
              >
                <Text style={styles.dpadIcon}>◀</Text>
              </Pressable>
              <Pressable
                style={[styles.dpadBtn, styles.jumpBtn]}
                onPressIn={() => setKey('jump', true)}
                onPressOut={() => setKey('jump', false)}
              >
                <Text style={[styles.dpadIcon, { color: '#ffff00', fontSize: 13 }]}>JUMP</Text>
              </Pressable>
              <Pressable
                style={styles.dpadBtn}
                onPressIn={() => setKey('right', true)}
                onPressOut={() => setKey('right', false)}
              >
                <Text style={styles.dpadIcon}>▶</Text>
              </Pressable>
              <Pressable
                style={[styles.dpadBtn, styles.boostBtn]}
                onPressIn={() => setKey('boost', true)}
                onPressOut={() => setKey('boost', false)}
              >
                <Text style={[styles.dpadIcon, { color: '#ff00cc', fontSize: 11 }]}>BOOST</Text>
              </Pressable>
            </View>

            {/* Boost bar */}
            <View style={styles.boostBarWrap}>
              <Text style={styles.boostLabel}>BOOST</Text>
              <View style={styles.boostTrack}>
                <View style={[styles.boostFill, { width: `${(s?.player.boost ?? 1) * 100}%` }]} />
              </View>
            </View>

            {/* Kick */}
            <Pressable
              style={styles.kickBtn}
              onPressIn={() => setKey('kick', true)}
            >
              <Text style={styles.kickText}>⚡ KICK</Text>
            </Pressable>
          </View>
        )}

        {/* Game over card */}
        {phase === 'over' && (
          <View style={styles.overlay}>
            <View style={[styles.card, { maxWidth: dialogMax }]}>
              <GameOverExitRow
                onMinigames={() => router.replace(ROUTE_MINIGAMES)}
                onHome={() => router.replace(ROUTE_HOME)}
              />
              <Text style={styles.goTitle}>
                {(endStatsRef.current.scoreP1 > (s?.scoreP2 ?? 0)) ? 'You Win! 🏆' : 'CPU Wins!'}
              </Text>
              <Text style={styles.goScore}>
                You {endStatsRef.current.scoreP1} – {s?.scoreP2 ?? 0} CPU
              </Text>
              {h2hSkillContest ? (
                <>
                  <Text style={styles.practiceNote}>
                    Head-to-head uses your goal count ({endStatsRef.current.scoreP1}) vs your opponent&apos;s run.
                  </Text>
                  {h2hSubmitPhase === 'loading' ? (
                    <Text style={styles.practiceNote}>Submitting your run…</Text>
                  ) : null}
                  {h2hSubmitPhase === 'error' ? (
                    <>
                      <Text style={styles.practiceNote}>Could not submit this run.</Text>
                      <AppButton title="Retry submit" className="mt-2" onPress={() => setH2hRetryKey((k) => k + 1)} />
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
                </>
              ) : null}
              {!h2hSkillContest && playMode === 'prize' && (
                <Text style={styles.goTickets}>
                  +{ticketsFromTurboScore(endStatsRef.current.scoreP1)} redeem tickets
                </Text>
              )}
              <AppButton title="Play Again" onPress={resetRun} className="mb-3" />
              {!h2hSkillContest && playMode === 'prize' ? (
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
                      <Text style={styles.practiceNote}>Could not save score.</Text>
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
              ) : !h2hSkillContest ? (
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
              ) : null}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────

const CYAN = '#00ffff';
const PINK = '#ff00cc';
const ORANGE = '#ff6600';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#02001a' },
  root: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 8,
    zIndex: 30,
  },
  backBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  scoreCol: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  scoreYou: {
    fontSize: 34, fontWeight: '900', color: ORANGE,
    textShadowColor: ORANGE, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
  },
  scoreSep: { fontSize: 28, fontWeight: '900', color: 'rgba(255,255,255,0.3)' },
  scoreCpu: {
    fontSize: 34, fontWeight: '900', color: CYAN,
    textShadowColor: CYAN, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
  },
  vsH2h: {
    marginLeft: 8,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(253,224,71,0.95)',
    maxWidth: 120,
  },
  creditsPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1, borderColor: 'rgba(94,234,212,0.35)',
    minWidth: 72, justifyContent: 'center',
  },
  creditsText: { color: 'rgba(226,232,240,0.95)', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  timer: {
    textAlign: 'center',
    fontSize: 20, fontWeight: '700',
    color: '#ffff00',
    textShadowColor: '#ffff00', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
    marginBottom: 4,
  },

  arenaWrap: { alignItems: 'center', paddingHorizontal: 8 },
  arena: {
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(0,255,255,0.3)',
    shadowColor: CYAN, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  groundLine: {
    position: 'absolute', height: 2,
    backgroundColor: '#cc00ff',
    shadowColor: '#cc00ff', shadowOpacity: 0.9, shadowRadius: 8, elevation: 4,
  },
  goal: {
    position: 'absolute', borderWidth: 2,
    shadowOpacity: 0.7, shadowRadius: 10, elevation: 4, borderRadius: 2,
  },
  centerLine: {
    position: 'absolute', top: 0, width: 1,
    backgroundColor: 'rgba(0,255,255,0.1)',
  },

  // Ready overlay
  readyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,0,26,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
    zIndex: 40,
  },
  readyTitle: {
    fontSize: 36, fontWeight: '900', letterSpacing: 6,
    color: CYAN, textShadowColor: CYAN, textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 },
  },
  readyMode: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: '#fde047' },
  readyHint: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },

  // Controls
  controlsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1.5, borderTopColor: 'rgba(0,255,255,0.25)',
    backgroundColor: 'rgba(0,0,15,0.96)',
    gap: 8, marginTop: 8,
  },
  dpad: { flexDirection: 'row', flexWrap: 'wrap', width: 148, gap: 5 },
  dpadBtn: {
    width: 46, height: 46, borderRadius: 8,
    backgroundColor: 'rgba(0,255,255,0.06)',
    borderWidth: 1.5, borderColor: 'rgba(0,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  jumpBtn: { borderColor: 'rgba(255,255,0,0.4)', backgroundColor: 'rgba(255,255,0,0.06)' },
  boostBtn: { borderColor: 'rgba(255,0,204,0.4)', backgroundColor: 'rgba(255,0,204,0.06)' },
  dpadIcon: { color: CYAN, fontSize: 18, fontWeight: '700' },

  boostBarWrap: { alignItems: 'center', gap: 4, flex: 1 },
  boostLabel: { fontSize: 8, letterSpacing: 2, color: 'rgba(255,0,204,0.7)', fontWeight: '700' },
  boostTrack: {
    width: 72, height: 10,
    backgroundColor: 'rgba(255,0,204,0.1)',
    borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,0,204,0.4)', overflow: 'hidden',
  },
  boostFill: {
    height: '100%', backgroundColor: PINK,
    shadowColor: PINK, shadowOpacity: 0.8, shadowRadius: 6, borderRadius: 5,
  },
  kickBtn: {
    width: 80, height: 52, borderRadius: 10,
    backgroundColor: 'rgba(255,102,0,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(255,102,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ORANGE, shadowOpacity: 0.3, shadowRadius: 8,
  },
  kickText: { color: ORANGE, fontSize: 12, fontWeight: '800', letterSpacing: 2 },

  // Game over
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,15,0.92)',
    justifyContent: 'center', alignItems: 'center',
    padding: 24, zIndex: 50,
  },
  card: {
    width: '100%',
    padding: 20, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(0,255,255,0.35)',
    backgroundColor: 'rgba(10,15,28,0.98)',
    shadowColor: CYAN, shadowOpacity: 0.12, shadowRadius: 20,
    gap: 10,
  },
  goTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  goScore: { color: 'rgba(148,163,184,0.95)', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  goTickets: { color: '#FDE047', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  practiceNote: { color: 'rgba(148,163,184,0.95)', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});