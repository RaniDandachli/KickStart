import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { beginMinigamePrizeRun } from '@/lib/beginMinigamePrizeRun';
import { assertBackendPrizeSignedIn, assertPrizeRunReservation } from '@/lib/prizeRunGuards';
import { consumePrizeRunEntryCredits, STACKER_PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { alertInsufficientPrizeCredits } from '@/lib/arcadeCreditsShop';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';
import { useAutoSubmitOnPhaseOver } from '@/lib/useAutoSubmitOnPhaseOver';
import {
  awardRedeemTicketsForPrizeRun,
  STACKER_JACKPOT_TICKETS,
  ticketsFromStackerPrizeRun,
} from '@/lib/ticketPayouts';
import { arcade } from '@/lib/arcadeTheme';
import { getSupabase } from '@/supabase/client';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { GameOverExitRow } from '@/minigames/ui/GameOverExitRow';
import { useMinigameExitNav } from '@/minigames/ui/useMinigameExitNav';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { minigameImmersiveStageWidth, minigameStageMaxWidth } from '@/minigames/ui/minigameWebMaxWidth';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';

import {
  STACKER_BASE,
  STACKER_GRID_COLS,
  STACKER_LATE_MULT,
  STACKER_LATE_ROW_START,
  STACKER_SPEED_MAX,
  STACKER_SPEED_MULT,
  STACKER_SPEED_START,
  STACKER_WIN_ROWS,
} from './stackerConstants';

const STORAGE_BEST_ROWS = '@kickclash/stacker_best_rows_v1';

type Seg = { left: number; width: number };

function overlap(aLeft: number, aW: number, bLeft: number, bW: number): Seg | null {
  const lo = Math.max(aLeft, bLeft);
  const hi = Math.min(aLeft + aW, bLeft + bW);
  const w = hi - lo;
  if (w <= 0.02) return null;
  return { left: lo, width: w };
}

function stackTarget(placed: Seg[]): Seg {
  return placed.length === 0 ? { ...STACKER_BASE } : placed[placed.length - 1]!;
}

function tierLabel(w: number): string {
  if (w >= 3) return 'Major (3)';
  if (w >= 2) return 'Minor (2)';
  return 'Jackpot (1)';
}

function tierColor(w: number): string {
  if (w >= 3) return '#22D3EE';
  if (w >= 2) return '#E879F9';
  return '#FACC15';
}

type GameRef = {
  placed: Seg[];
  blockLeft: number;
  blockDir: 1 | -1;
  speed: number;
  alive: boolean;
};

function createGame(): GameRef {
  return {
    placed: [],
    blockLeft: 0,
    blockDir: 1,
    speed: STACKER_SPEED_START,
    alive: true,
  };
}

export default function StackerGame({ playMode = 'practice' }: { playMode?: 'practice' | 'prize' }) {
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
  const insets = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();
  const stageMax = useMemo(() => minigameImmersiveStageWidth(sw), [sw]);
  const dialogMax = useMemo(() => minigameStageMaxWidth(360), [sw]);

  const [gameSize, setGameSize] = useState<{ w: number; h: number } | null>(null);

  const onGameLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setGameSize({ w: width, h: height });
    }
  }, []);

  const gw = gameSize?.w ?? sw;
  const gh = gameSize?.h ?? Math.max(320, sh - insets.top - insets.bottom);
  const unit = gw / STACKER_GRID_COLS;
  const rowH = Math.max(10, Math.round(gh / (STACKER_WIN_ROWS + 2)));

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const [, setUiTick] = useState(0);
  const gameRef = useRef<GameRef>(createGame());
  const startTimeRef = useRef(0);
  const tapCountRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const wonRef = useRef(false);
  const endStatsRef = useRef({ rows: 0, durationMs: 0, won: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitErr, setSubmitErr] = useState(false);
  const [autoSubmitSeq, setAutoSubmitSeq] = useState(0);
  const prizeRunReservationRef = useRef<string | null>(null);
  const [bestRows, setBestRows] = useState<number>(0);

  const bump = useCallback(() => setUiTick((t) => t + 1), []);

  const endGame = useCallback(
    (won: boolean) => {
      const g = gameRef.current;
      g.alive = false;
      wonRef.current = won;
      const rows = g.placed.length;
      const durationMs = Math.max(0, Date.now() - startTimeRef.current);
      endStatsRef.current = { rows, durationMs, won };
      if (playMode === 'prize') {
        awardRedeemTicketsForPrizeRun(ticketsFromStackerPrizeRun(won));
      }
      void (async () => {
        try {
          const prev = await AsyncStorage.getItem(STORAGE_BEST_ROWS);
          const n = prev != null ? parseInt(prev, 10) || 0 : 0;
          if (rows > n) {
            await AsyncStorage.setItem(STORAGE_BEST_ROWS, String(rows));
            setBestRows(rows);
          }
        } catch {
          /* ignore */
        }
      })();
      setPhase('over');
      setAutoSubmitSeq((n) => n + 1);
      bump();
    },
    [bump, playMode],
  );

  const step = useCallback(
    (totalDtMs: number) => {
      const g = gameRef.current;
      if (!g.alive) return;

      runFixedPhysicsSteps(totalDtMs, (dtMs) => {
        if (!g.alive) return false;
        const target = stackTarget(g.placed);
        const bw = target.width;
        const maxLeft = Math.max(0, STACKER_GRID_COLS - bw);
        const t = dtMs / 1000;
        g.blockLeft += g.blockDir * g.speed * t;

        if (g.blockLeft <= 0) {
          g.blockLeft = 0;
          g.blockDir = 1;
        } else if (g.blockLeft >= maxLeft) {
          g.blockLeft = maxLeft;
          g.blockDir = -1;
        }
        return true;
      });

      if (g.alive) bump();
    },
    [bump],
  );

  useRafLoop(step, phase === 'playing');

  const resetRun = useCallback(() => {
    gameRef.current = createGame();
    startTimeRef.current = 0;
    tapCountRef.current = 0;
    lastTapAtRef.current = 0;
    wonRef.current = false;
    setSubmitOk(false);
    setSubmitErr(false);
    setPhase('ready');
    bump();
  }, [bump]);

  const startGame = useCallback(() => {
    void (async () => {
      if (playMode === 'prize') {
        if (ENABLE_BACKEND) {
          if (!assertBackendPrizeSignedIn(ENABLE_BACKEND, uid)) return;
          const r = await beginMinigamePrizeRun('stacker');
          if (!r.ok) {
            if (r.error === 'insufficient_credits') {
              alertInsufficientPrizeCredits(
                router,
                `Stacker prize runs cost ${STACKER_PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
              );
            } else {
              Alert.alert('Could not start prize run', r.message ?? 'Try again.');
            }
            return;
          }
          prizeRunReservationRef.current = r.reservationId;
          if (uid) invalidateProfileEconomy(queryClient, uid);
        } else {
          const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits, STACKER_PRIZE_RUN_ENTRY_CREDITS);
          if (!ok) {
            alertInsufficientPrizeCredits(
              router,
              `Stacker prize runs cost ${STACKER_PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
            );
            return;
          }
        }
      }
      gameRef.current = createGame();
      startTimeRef.current = Date.now();
      tapCountRef.current = 0;
      lastTapAtRef.current = 0;
      wonRef.current = false;
      setSubmitOk(false);
      setSubmitErr(false);
      setPhase('playing');
      bump();
    })();
  }, [bump, playMode, profileQ.data?.prize_credits, router, queryClient, uid]);

  const onStackTap = useCallback(() => {
    if (phase !== 'playing') return;
    const g = gameRef.current;
    if (!g.alive) return;

    const now = Date.now();
    if (now - lastTapAtRef.current < 90) return;
    lastTapAtRef.current = now;

    tapCountRef.current += 1;
    const target = stackTarget(g.placed);
    const o = overlap(g.blockLeft, target.width, target.left, target.width);
    if (!o) {
      endGame(false);
      return;
    }

    g.placed.push(o);
    g.speed = Math.min(STACKER_SPEED_MAX, g.speed * STACKER_SPEED_MULT);
    if (g.placed.length >= STACKER_LATE_ROW_START) {
      g.speed = Math.min(STACKER_SPEED_MAX, g.speed * STACKER_LATE_MULT);
    }
    g.blockLeft = 0;
    g.blockDir = 1;

    if (g.placed.length >= STACKER_WIN_ROWS) {
      endGame(true);
      return;
    }

    bump();
  }, [bump, endGame, phase]);

  useWebGameKeyboard(phase === 'playing', {
    Space: (down) => {
      if (down) onStackTap();
    },
    Enter: (down) => {
      if (down) onStackTap();
    },
  });

  /** Web: game over — Space / Enter = Play Again (same as in-run drop keys). */
  useWebGameKeyboard(Platform.OS === 'web' && phase === 'over', {
    Space: (down) => {
      if (!down) return;
      resetRun();
    },
    Enter: (down) => {
      if (!down) return;
      resetRun();
    },
  });

  const submitScore = useCallback(async () => {
    const { rows, durationMs } = endStatsRef.current;
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
      if (!assertPrizeRunReservation(prizeRun, ENABLE_BACKEND, prizeRunReservationRef.current)) {
        setSubmitErr(true);
        return;
      }
      const body: Record<string, unknown> = {
        game_type: 'stacker' as const,
        score: rows,
        duration_ms: durationMs,
        taps: tapCountRef.current,
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
  }, [playMode, queryClient, uid]);

  useAutoSubmitOnPhaseOver({
    phase,
    overValue: 'over',
    runToken: autoSubmitSeq,
    onSubmit: submitScore,
  });

  useEffect(() => {
    void (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_BEST_ROWS);
        if (v != null) setBestRows(Math.max(0, parseInt(v, 10) || 0));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const g = gameRef.current;
  const target = stackTarget(g.placed);
  const movingW = target.width;
  const stackDepth = g.placed.length;
  const cellScore = g.placed.reduce((s, seg) => s + seg.width, 0);
  const accuracyPct =
    tapCountRef.current > 0
      ? Math.min(100, Math.round((100 * stackDepth) / Math.max(1, tapCountRef.current)))
      : 100;
  const credits = profileQ.data?.prize_credits;
  const showSideRails = Platform.OS === 'web' && sw >= 900;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <LinearGradient colors={['#030510', '#0a0520', '#100828']} style={styles.gradFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
        <View
          style={[
            styles.headerChrome,
            {
              paddingLeft: Math.max(insets.left, 10),
              paddingRight: Math.max(insets.right, 10),
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <Pressable
              onPress={onHeaderBackPress}
              hitSlop={10}
              style={({ pressed }) => [styles.topIconTile, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <SafeIonicons name="chevron-back" size={22} color="#f8fafc" />
            </Pressable>
            <View style={styles.creditsPill}>
              <SafeIonicons name="diamond-outline" size={16} color="#c084fc" />
              <Text style={styles.creditsNum}>{credits != null ? String(credits) : '—'}</Text>
              <View style={styles.creditsPlus}>
                <Text style={styles.creditsPlusTxt}>+</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerCenter}>
            <View style={styles.titleRow}>
              <Text style={styles.titleFlair}>‹</Text>
              <Text style={styles.brandTitle}>STACKER</Text>
              <Text style={styles.titleFlair}>›</Text>
            </View>
            <Text style={styles.headerSubPurple}>
              {stackDepth} / {STACKER_WIN_ROWS} · {tierLabel(movingW).toUpperCase()}
            </Text>
            <View style={styles.jackpotPill}>
              <SafeIonicons name="ribbon-outline" size={14} color="#0f172a" />
              <Text style={styles.jackpotPillTxt}>
                {playMode === 'prize' ? `${STACKER_PRIZE_RUN_ENTRY_CREDITS} CR` : 'PRACTICE'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.bestBox}>
              <Text style={styles.bestLbl}>BEST SCORE</Text>
              <Text style={styles.bestNum}>{bestRows}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.topIconTile, pressed && { opacity: 0.85 }]}
              onPress={() =>
                Alert.alert(
                  'Stacker',
                  'Drop when the sliding row lines up with the stack below. Miss the overlap and the run ends. Reach the top for jackpot (prize mode).',
                )
              }
              accessibilityRole="button"
              accessibilityLabel="How Stacker works"
            >
              <SafeIonicons name="settings-outline" size={20} color="#e2e8f0" />
            </Pressable>
          </View>
        </View>

        <View style={styles.mainRow}>
          {showSideRails ? (
            <View style={styles.sideCard}>
              <Text style={styles.sideTitle}>HOW TO PLAY</Text>
              <View style={styles.howStep}>
                <Text style={styles.howNum}>1</Text>
                <View style={styles.howBlockPurple} />
                <Text style={styles.howTxt}>TIME IT — tap when aligned.</Text>
              </View>
              <View style={styles.howStep}>
                <Text style={styles.howNum}>2</Text>
                <View style={styles.howRowGhost}>
                  <View style={styles.howBlockGold} />
                  <View style={styles.howGhost} />
                </View>
                <Text style={styles.howTxt}>LINE IT UP — match the width below.</Text>
              </View>
              <View style={styles.howStep}>
                <Text style={styles.howNum}>3</Text>
                <View style={styles.howMiniStack}>
                  <View style={styles.howMiniSeg} />
                  <View style={[styles.howMiniSeg, { opacity: 0.85 }]} />
                  <View style={[styles.howMiniSeg, { opacity: 0.7 }]} />
                </View>
                <Text style={styles.howTxt}>STACK HIGH — climb to the jackpot row.</Text>
              </View>
            </View>
          ) : null}

          <View
            style={[styles.boardStage, !showSideRails ? { maxWidth: stageMax } : null]}
            onLayout={onGameLayout}
          >
            <View style={styles.boardFrame}>
              <View style={styles.gridHint}>
                {Array.from({ length: STACKER_GRID_COLS }, (_, i) => (
                  <View key={i} style={[styles.gridV, { left: i * unit, width: 1 }]} />
                ))}
              </View>
              <View style={styles.dropBeam} pointerEvents="none">
                <Text style={styles.dropBeamTxt}>▼</Text>
                <Text style={styles.dropBeamTxt}>▼</Text>
                <Text style={styles.dropBeamTxt}>▼</Text>
              </View>

              <View style={styles.tower}>
                <View style={styles.stackCol}>
                  <View
                    style={[
                      styles.block,
                      styles.basePad,
                      {
                        width: STACKER_BASE.width * unit - 4,
                        height: rowH - 4,
                        left: STACKER_BASE.left * unit + 2,
                        bottom: 0,
                      },
                    ]}
                  />
                  {g.placed.map((seg, idx) => (
                    <View
                      key={`p-${idx}`}
                      style={[
                        styles.block,
                        styles.blockGlow,
                        {
                          width: seg.width * unit - 4,
                          height: rowH - 4,
                          left: seg.left * unit + 2,
                          bottom: (idx + 1) * rowH,
                          backgroundColor: tierColor(seg.width),
                          borderColor: 'rgba(248,250,252,0.45)',
                          shadowColor: tierColor(seg.width),
                        },
                      ]}
                    />
                  ))}
                  {phase === 'playing' && g.alive ? (
                    <View
                      style={[
                        styles.block,
                        styles.blockGlow,
                        styles.blockActive,
                        {
                          width: movingW * unit - 4,
                          height: rowH - 4,
                          left: g.blockLeft * unit + 2,
                          bottom: (g.placed.length + 1) * rowH,
                          backgroundColor: tierColor(movingW),
                          borderColor: '#fef9c3',
                          shadowColor: tierColor(movingW),
                          zIndex: 4,
                          elevation: 8,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              </View>

              {phase === 'ready' ? (
                <Pressable style={styles.startLayer} onPress={startGame}>
                  <View style={styles.startHint}>
                    <Text style={styles.startMode}>
                      {playMode === 'prize'
                        ? `${STACKER_PRIZE_RUN_ENTRY_CREDITS} credits · ${STACKER_JACKPOT_TICKETS} tickets on full stack only`
                        : 'Practice — no credits'}
                    </Text>
                    <Text style={styles.startTitle}>TAP TO START</Text>
                    <Text style={styles.startSub}>
                      {STACKER_WIN_ROWS} rows to jackpot · speed ramps · overlap to stay alive
                      {Platform.OS === 'web' ? '\nWeb: Space or Enter to drop' : ''}
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              {phase === 'playing' ? (
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={onStackTap}
                  accessibilityRole="button"
                  accessibilityLabel="Stack block"
                />
              ) : null}
            </View>
          </View>

          {showSideRails ? (
            <View style={styles.sideCard}>
              <Text style={styles.sideTitle}>RUN</Text>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>CELLS STACKED</Text>
                <Text style={[styles.statValue, { color: '#f8fafc' }]}>{cellScore}</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>ROWS</Text>
                <Text style={[styles.statValue, { color: '#FACC15' }]}>{stackDepth}</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>ACCURACY</Text>
                <Text style={[styles.statValue, { color: '#7dd3fc' }]}>{accuracyPct}%</Text>
              </View>
            </View>
          ) : null}
        </View>

        {phase === 'playing' ? (
          <View style={[styles.dropBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <SafeIonicons name="hand-left-outline" size={28} color="#f8fafc" />
            <View style={styles.dropBarTextCol}>
              <Text style={styles.dropBarLine1}>{Platform.OS === 'web' ? 'TAP / ENTER / SPACE' : 'TAP'}</Text>
              <Text style={styles.dropBarLine2}>TO DROP</Text>
            </View>
          </View>
        ) : null}
      </LinearGradient>

      {phase === 'over' ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={[styles.card, { maxWidth: dialogMax }]}>
            <GameOverExitRow
              minigamesLabel={replacePrimaryLabel}
              onMinigames={replaceToPrimaryExit}
              onHome={replaceToHomeTab}
            />
            <Text style={styles.goTitle}>{wonRef.current ? 'Jackpot!' : 'Game over'}</Text>
            <Text style={styles.goScore}>
              Rows stacked: {endStatsRef.current.rows}/{STACKER_WIN_ROWS}
            </Text>
            {playMode === 'prize' ? (
              <Text style={styles.goTickets}>
                {wonRef.current
                  ? `+${ticketsFromStackerPrizeRun(true)} redeem tickets (jackpot)`
                  : 'No tickets — reach the top row to earn'}
              </Text>
            ) : null}
            <AppButton title="Play Again" onPress={resetRun} className="mb-3" />
            {playMode === 'prize' ? (
              <>
                {submitting ? (
                  <>
                    <Text style={styles.goTickets}>Saving score…</Text>
                    <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
                  </>
                ) : null}
                {submitOk ? <Text style={styles.goTickets}>Score saved.</Text> : null}
                {submitErr && !submitting ? (
                  <>
                    <Text style={styles.goTickets}>Could not save score.</Text>
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
                    <Text style={styles.goTickets}>Saving practice run…</Text>
                    <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
                  </>
                ) : null}
                {submitOk ? (
                  <Text style={styles.goTickets}>Practice run saved (no prize tickets).</Text>
                ) : null}
                {submitErr && !submitting ? (
                  <>
                    <Text style={styles.goTickets}>Could not save run.</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030510' },
  gradFill: { flex: 1, width: '100%', minHeight: 0 },
  headerChrome: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 10,
    zIndex: 30,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 152 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  headerRight: {
    width: 152,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 8,
  },
  topIconTile: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
  },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.38)',
  },
  creditsNum: { color: '#f8fafc', fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  creditsPlus: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(76,29,149,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsPlusTxt: { color: '#f8fafc', fontSize: 15, fontWeight: '900', marginTop: -2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleFlair: { color: '#a855f7', fontSize: 20, fontWeight: '300' },
  brandTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 4,
  },
  headerSubPurple: {
    marginTop: 4,
    color: '#d8b4fe',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  jackpotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FACC15',
    borderWidth: 1,
    borderColor: 'rgba(253,224,71,0.95)',
  },
  jackpotPillTxt: { color: '#0f172a', fontSize: 11, fontWeight: '900' },
  bestBox: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.5)',
    alignItems: 'center',
  },
  bestLbl: { color: 'rgba(196,181,253,0.95)', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  bestNum: { color: '#f8fafc', fontSize: 18, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] },
  mainRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 6,
    gap: 8,
  },
  boardStage: { flex: 1, minWidth: 0, minHeight: 0 },
  boardFrame: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(56,189,248,0.5)',
    backgroundColor: '#020617',
    overflow: 'hidden',
    position: 'relative',
  },
  sideCard: {
    width: 168,
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(6,8,18,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.5)',
    alignSelf: 'stretch',
  },
  sideTitle: {
    color: 'rgba(196,181,253,0.95)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  howStep: { marginBottom: 14 },
  howNum: { color: 'rgba(148,163,184,0.88)', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  howBlockPurple: {
    height: 12,
    width: 52,
    borderRadius: 4,
    backgroundColor: '#a855f7',
    marginBottom: 6,
  },
  howRowGhost: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  howBlockGold: { height: 12, width: 42, borderRadius: 4, backgroundColor: '#FACC15' },
  howGhost: {
    height: 12,
    width: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.5)',
  },
  howMiniStack: { flexDirection: 'column', gap: 3, marginBottom: 6 },
  howMiniSeg: { height: 8, width: 58, borderRadius: 3, backgroundColor: '#c084fc' },
  howTxt: { color: 'rgba(226,232,240,0.9)', fontSize: 11, fontWeight: '600', lineHeight: 15 },
  statBlock: { marginBottom: 14 },
  statLabel: { color: 'rgba(148,163,184,0.92)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  statValue: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  dropBeam: {
    position: 'absolute',
    top: 40,
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  dropBeamTxt: { color: 'rgba(167,139,250,0.45)', fontSize: 11, fontWeight: '900' },
  dropBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginHorizontal: 14,
    marginTop: 4,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
  },
  dropBarTextCol: { alignItems: 'center' },
  dropBarLine1: { color: '#f8fafc', fontSize: 15, fontWeight: '900', letterSpacing: 0.8 },
  dropBarLine2: { color: '#c084fc', fontSize: 13, fontWeight: '800', marginTop: 2, letterSpacing: 2 },
  gridHint: { ...StyleSheet.absoluteFillObject },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(250,204,21,0.045)',
  },
  tower: { flex: 1, width: '100%', position: 'relative' },
  stackCol: { flex: 1, width: '100%', position: 'relative' },
  block: {
    position: 'absolute',
    borderRadius: 7,
    borderWidth: 2,
  },
  blockGlow: {
    ...Platform.select({
      ios: {
        shadowOpacity: 0.45,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {
        elevation: 8,
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  blockActive: {
    ...Platform.select({
      ios: { shadowOpacity: 0.75, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
      default: { elevation: 12, shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
    }),
  },
  basePad: {
    backgroundColor: 'rgba(51,65,85,0.96)',
    borderColor: 'rgba(148,163,184,0.65)',
  },
  startLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    backgroundColor: 'rgba(6,13,24,0.78)',
    zIndex: 10,
  },
  startHint: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  startMode: {
    color: 'rgba(253, 224, 71, 0.95)',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  startTitle: {
    color: arcade.gold,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
  },
  startSub: {
    marginTop: 10,
    color: 'rgba(226, 232, 240, 0.88)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,13,24,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 50,
  },
  card: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: arcade.goldBorder,
    backgroundColor: arcade.navy1,
  },
  goTitle: {
    color: arcade.white,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
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
});
