import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useRouter } from 'expo-router';
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
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { beginMinigamePrizeRun } from '@/lib/beginMinigamePrizeRun';
import { assertBackendPrizeSignedIn, assertPrizeRunReservation } from '@/lib/prizeRunGuards';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { alertInsufficientPrizeCredits } from '@/lib/arcadeCreditsShop';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { useAutoSubmitOnPhaseOver } from '@/lib/useAutoSubmitOnPhaseOver';
import {
  awardRedeemTicketsForPrizeRun,
  TILE_CLASH_POINTS_PER_TICKET,
  ticketsFromTileClashScore,
} from '@/lib/ticketPayouts';
import { arcade } from '@/lib/arcadeTheme';
import { getSupabase } from '@/supabase/client';
import {
  MINIGAME_HUD_MS,
  resetMinigameHudClock,
  shouldEmitMinigameHudFrame,
} from '@/minigames/core/minigameHudThrottle';
import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { GameOverExitRow, ROUTE_HOME, ROUTE_MINIGAMES } from '@/minigames/ui/GameOverExitRow';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { useLockNavigatorGesturesWhile } from '@/minigames/ui/useLockNavigatorGesturesWhile';
import { minigameImmersiveStageWidth, minigameStageMaxWidth } from '@/minigames/ui/minigameWebMaxWidth';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { useTileClashMusic } from '@/minigames/tileclash/useTileClashMusic';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';
import { finalizeDailyScores } from '@/lib/dailyFreeTournament';
import type { DailyTournamentBundle } from '@/types/dailyTournamentPlay';
import type { H2hSkillContestBundle } from '@/types/match';

const COLS = 4;
/** Abstract vertical range (game logic). */
const LANE_H = 200;
const TILE_H = 22;
const HIT_TOP = 120;
const HIT_BOTTOM = 186;
/** Extra logical px around the amber band for tap + overlap checks (float edges + “feels in” taps). */
const TAP_BAND_PAD = 8;
const BASE_SCROLL = 0.056;
const SPAWN_MS = 520;
const SPEED_BUMP = 1.12;

/** iOS Safari + RN Web: reduce tap delay / gesture conflicts on the game board. */
const WEB_BOARD_TOUCH: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      } as ViewStyle)
    : undefined;

type Tile = { id: number; col: number; y: number; kind: 'good' | 'bad' };

type GameModel = {
  tiles: Tile[];
  nextId: number;
  spawnAcc: number;
  scrollPerMs: number;
  score: number;
  streak: number;
  goodTaps: number;
  alive: boolean;
};

function inHitOverlap(y: number): boolean {
  const lo = HIT_TOP - TAP_BAND_PAD;
  const hi = HIT_BOTTOM + TAP_BAND_PAD;
  return y + TILE_H >= lo && y <= hi;
}

/**
 * Resolve which tile a column tap hits. Older rows leave bad tiles scrolling behind the new
 * row's green in the same column; picking max-y over *all* kinds made the 3rd+ tap often
 * register the stale bad. Prefer any good in the band (frontmost good if stacked), else bad.
 */
function findTileInColumn(tiles: Tile[], col: number): Tile | undefined {
  let bestGood: Tile | undefined;
  let bestGoodY = -1e9;
  let bestBad: Tile | undefined;
  let bestBadY = -1e9;
  for (const t of tiles) {
    if (t.col !== col || !inHitOverlap(t.y)) continue;
    if (t.kind === 'good') {
      if (t.y > bestGoodY) {
        bestGoodY = t.y;
        bestGood = t;
      }
    } else if (t.y > bestBadY) {
      bestBadY = t.y;
      bestBad = t;
    }
  }
  return bestGood ?? bestBad;
}

function createGame(): GameModel {
  return {
    tiles: [],
    nextId: 1,
    spawnAcc: SPAWN_MS * 0.85,
    scrollPerMs: BASE_SCROLL,
    score: 0,
    streak: 0,
    goodTaps: 0,
    alive: true,
  };
}

function spawnRow(m: GameModel, baseY?: number): void {
  const goodCol = Math.floor(Math.random() * COLS);
  const y = baseY ?? -TILE_H - 2;
  for (let col = 0; col < COLS; col++) {
    m.tiles.push({
      id: m.nextId++,
      col,
      y,
      kind: col === goodCol ? 'good' : 'bad',
    });
  }
}

export default function TileClashGame({
  playMode = 'practice',
  dailyTournament,
  h2hSkillContest,
}: {
  playMode?: 'practice' | 'prize';
  dailyTournament?: DailyTournamentBundle;
  h2hSkillContest?: H2hSkillContestBundle;
}) {
  useHidePlayTabBar();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const queryClient = useQueryClient();
  const { width: sw } = useWindowDimensions();
  const stageMax = useMemo(() => minigameImmersiveStageWidth(sw), [sw]);
  const dialogMax = useMemo(() => minigameStageMaxWidth(360), [sw]);
  const insets = useSafeAreaInsets();
  const [boardSize, setBoardSize] = useState({ w: Math.max(200, sw - 16), h: 0 });

  const boardW = boardSize.w;
  const boardH = boardSize.h > 0 ? boardSize.h : 360;
  const scaleY = boardH / LANE_H;
  const colW = boardW / COLS;

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  useLockNavigatorGesturesWhile(phase === 'playing');
  useTileClashMusic(phase === 'playing');
  const [, setUiTick] = useState(0);
  const modelRef = useRef<GameModel>(createGame());
  const startTimeRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const intervalsRef = useRef<number[]>([]);
  const tapCountRef = useRef(0);
  const endStatsRef = useRef({ score: 0, durationMs: 0, taps: 0, intervals: [] as number[] });
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [submitErr, setSubmitErr] = useState(false);
  const [autoSubmitSeq, setAutoSubmitSeq] = useState(0);
  const prizeRunReservationRef = useRef<string | null>(null);
  const [redFlash, setRedFlash] = useState(false);
  const dailyCompleteRef = useRef(false);
  const lastHudEmitRef = useRef(0);

  const bump = useCallback(() => setUiTick((t) => t + 1), []);

  const flashError = useCallback(() => {
    setRedFlash(true);
    setTimeout(() => setRedFlash(false), 140);
  }, []);

  const endGame = useCallback(
    (m: GameModel) => {
      m.alive = false;
      const durationMs = Math.max(0, Date.now() - startTimeRef.current);
      endStatsRef.current = {
        score: m.score,
        durationMs,
        taps: tapCountRef.current,
        intervals: [...intervalsRef.current],
      };
      if (!dailyTournament && !h2hSkillContest && playMode === 'prize') {
        awardRedeemTicketsForPrizeRun(ticketsFromTileClashScore(m.score));
      }
      setPhase('over');
      if (!dailyTournament && !h2hSkillContest) {
        setAutoSubmitSeq((n) => n + 1);
      }
      bump();
    },
    [bump, playMode, dailyTournament, h2hSkillContest],
  );

  const step = useCallback(
    (totalDtMs: number) => {
      const m = modelRef.current;
      if (!m.alive) return;

      runFixedPhysicsSteps(totalDtMs, (dtMs) => {
        if (!m.alive) return false;
        const dy = m.scrollPerMs * dtMs;
        for (const t of m.tiles) {
          t.y += dy;
        }

        m.spawnAcc += dtMs;
        if (m.spawnAcc >= SPAWN_MS) {
          spawnRow(m);
          m.spawnAcc = 0;
        }

        for (const t of m.tiles) {
          if (t.kind !== 'good') continue;
          if (t.y > HIT_BOTTOM) {
            endGame(m);
            return false;
          }
        }

        m.tiles = m.tiles.filter((t) => t.y < LANE_H + 24);
        return true;
      });

      if (m.alive && shouldEmitMinigameHudFrame(lastHudEmitRef, MINIGAME_HUD_MS)) bump();
    },
    [bump, endGame],
  );

  useRafLoop(step, phase === 'playing');

  const resetRun = useCallback(() => {
    modelRef.current = createGame();
    startTimeRef.current = 0;
    lastTapAtRef.current = 0;
    intervalsRef.current = [];
    tapCountRef.current = 0;
    resetMinigameHudClock(lastHudEmitRef);
    setSubmitOk(false);
    setSubmitErr(false);
    setPhase('ready');
    bump();
  }, [bump]);

  const buildH2hBody = useCallback(() => {
    const { score, durationMs, taps, intervals } = endStatsRef.current;
    return {
      game_type: 'tile_clash' as const,
      score,
      duration_ms: durationMs,
      taps,
      tap_intervals_ms: intervals,
      match_session_id: h2hSkillContest!.matchSessionId,
    };
  }, [h2hSkillContest]);

  const { h2hSubmitPhase, h2hPoll, h2hRetryKey, setH2hRetryKey } = useH2hSkillContestSubmitAndPoll(
    h2hSkillContest,
    phase,
    buildH2hBody,
  );

  const startGame = useCallback(() => {
    void (async () => {
      if (!dailyTournament && !h2hSkillContest && playMode === 'prize') {
        if (ENABLE_BACKEND) {
          if (!assertBackendPrizeSignedIn(ENABLE_BACKEND, uid)) return;
          const r = await beginMinigamePrizeRun('tile_clash');
          if (!r.ok) {
            if (r.error === 'insufficient_credits') {
              alertInsufficientPrizeCredits(
                router,
                `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
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
              `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
            );
            return;
          }
        }
      }
      const m = createGame();
      spawnRow(m, HIT_TOP - 14);
      modelRef.current = m;
      startTimeRef.current = Date.now();
      lastTapAtRef.current = 0;
      intervalsRef.current = [];
      tapCountRef.current = 0;
      resetMinigameHudClock(lastHudEmitRef);
      setSubmitOk(false);
      setSubmitErr(false);
      setPhase('playing');
      bump();
    })();
  }, [bump, playMode, dailyTournament, h2hSkillContest, router, profileQ.data?.prize_credits, queryClient, uid]);

  const applyPlayingTap = useCallback(
    (col: number) => {
      const now = Date.now();
      tapCountRef.current += 1;
      if (lastTapAtRef.current > 0) {
        intervalsRef.current.push(now - lastTapAtRef.current);
      }
      lastTapAtRef.current = now;

      const m = modelRef.current;
      if (!m.alive) return;

      const hit = findTileInColumn(m.tiles, col);
      if (!hit) return;

      if (hit.kind === 'bad') {
        flashError();
        endGame(m);
        return;
      }

      m.tiles = m.tiles.filter((t) => t.id !== hit.id);
      m.streak += 1;
      m.goodTaps += 1;
      const mult = 1 + Math.floor(m.streak / 10);
      m.score += 1 * mult;

      if (m.goodTaps % 5 === 0) {
        m.scrollPerMs *= SPEED_BUMP;
      }

      bump();
    },
    [bump, endGame, flashError],
  );

  const onColumnPress = useCallback(
    (col: number) => {
      if (phase !== 'playing') return;
      applyPlayingTap(col);
    },
    [phase, applyPlayingTap],
  );

  useWebGameKeyboard(phase === 'playing', {
    Digit1: (down) => {
      if (down) onColumnPress(0);
    },
    Digit2: (down) => {
      if (down) onColumnPress(1);
    },
    Digit3: (down) => {
      if (down) onColumnPress(2);
    },
    Digit4: (down) => {
      if (down) onColumnPress(3);
    },
  });

  const submitScore = useCallback(async () => {
    const { score, durationMs, taps, intervals } = endStatsRef.current;
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
      const prizeRun = !dailyTournament && playMode === 'prize' && !h2hSkillContest;
      if (!assertPrizeRunReservation(prizeRun, ENABLE_BACKEND, prizeRunReservationRef.current)) {
        setSubmitErr(true);
        return;
      }
      const body: Record<string, unknown> = {
        game_type: 'tile_clash' as const,
        score,
        duration_ms: durationMs,
        taps,
        tap_intervals_ms: intervals,
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
  }, [dailyTournament, playMode, h2hSkillContest, queryClient, uid]);

  useAutoSubmitOnPhaseOver({
    phase,
    overValue: 'over',
    runToken: autoSubmitSeq,
    disabled: Boolean(dailyTournament || h2hSkillContest),
    onSubmit: submitScore,
  });

  const m = modelRef.current;
  const hitTopPx = (HIT_TOP - TAP_BAND_PAD) * scaleY;
  const hitH = (HIT_BOTTOM + TAP_BAND_PAD - (HIT_TOP - TAP_BAND_PAD)) * scaleY;
  const mult = 1 + Math.floor(m.streak / 10);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar} accessibilityRole="toolbar">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          onPress={() => router.back()}
        >
          <SafeIonicons name="chevron-back" size={28} color={arcade.white} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          Tile Clash
        </Text>
        <View style={styles.topBarSpacer} />
      </View>
      <View style={styles.root}>
        {/* Reference-style gold score ring */}
        <View style={styles.hudRow}>
          <View style={styles.scoreRing}>
            <Text style={styles.scoreRingText}>{m.score}</Text>
          </View>
          {(phase === 'playing' || phase === 'over') && (
            <Text style={styles.streakPill}>
              Streak {m.streak} · ×{mult}
            </Text>
          )}
          {(dailyTournament || h2hSkillContest) && phase !== 'over' ? (
            <Text style={styles.vsOppTile} numberOfLines={1}>
              vs {dailyTournament?.opponentDisplayName ?? h2hSkillContest?.opponentDisplayName}
            </Text>
          ) : null}
        </View>

        <View
          style={[styles.boardOuter, WEB_BOARD_TOUCH ?? false, { maxWidth: stageMax }]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) {
              setBoardSize({ w: width, h: height });
            }
          }}
        >
          {/* Lane backgrounds + vertical dividers (reference: 4 navy lanes) */}
          <View style={styles.laneStripes} pointerEvents="none">
            {Array.from({ length: COLS }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.laneCell,
                  {
                    flex: 1,
                    borderRightWidth: i < COLS - 1 ? 1 : 0,
                    backgroundColor: i % 2 === 0 ? 'rgba(15,40,71,0.95)' : 'rgba(10,28,52,0.98)',
                  },
                ]}
              />
            ))}
          </View>

          <View style={[styles.hitZone, { top: hitTopPx, height: hitH }]} pointerEvents="none">
            {phase === 'ready' ? (
              <Text style={styles.hitZoneReadyHint} numberOfLines={2}>
                Tap when the pale tile sits in this band — not above or below it.
              </Text>
            ) : null}
          </View>

          {m.tiles.map((t) => {
            const x = t.col * colW;
            const w = colW - 4;
            const y = t.y * scaleY;
            const h = TILE_H * scaleY;
            const inBand = inHitOverlap(t.y);
            const isGood = t.kind === 'good';
            return (
              <View
                key={t.id}
                pointerEvents="none"
                style={[
                  styles.tile,
                  {
                    left: x + 2,
                    top: y,
                    width: w,
                    height: h,
                    backgroundColor: isGood ? '#E0F2FE' : '#CBD5E1',
                    borderColor: isGood && inBand ? '#22D3EE' : isGood ? '#7DD3FC' : '#64748B',
                    borderWidth: isGood && inBand ? 3 : 2,
                    shadowColor: isGood && inBand ? '#22D3EE' : 'transparent',
                    shadowOpacity: isGood && inBand ? 0.95 : 0,
                    shadowRadius: isGood && inBand ? 12 : 0,
                    elevation: isGood && inBand ? 8 : 2,
                  },
                ]}
              />
            );
          })}

          {redFlash ? <View style={styles.redFlash} pointerEvents="none" /> : null}

          {phase === 'playing' ? (
            <View
              style={[StyleSheet.absoluteFill, styles.laneHitLayer, styles.columnTouchRow, WEB_BOARD_TOUCH]}
              pointerEvents="box-none"
            >
              {Array.from({ length: COLS }, (_, col) => (
                <Pressable
                  key={col}
                  accessibilityRole="button"
                  accessibilityLabel={`Column ${col + 1}`}
                  importantForAccessibility="no-hide-descendants"
                  style={styles.columnTouchCell}
                  onPressIn={() => onColumnPress(col)}
                />
              ))}
            </View>
          ) : null}

          {/* Tap anywhere to start — overlay is transparent above the hint so the amber band stays visible */}
          {phase === 'ready' ? (
            <Pressable style={[styles.tapToStartLayer, WEB_BOARD_TOUCH]} onPressIn={startGame}>
              <View style={styles.rulesBlock} pointerEvents="none">
                <Text style={styles.rulesTitle}>How to play</Text>
                <Text style={styles.rulesBody}>
                  • Each row has one pale / cyan-edged tile — that&apos;s the only safe tap. Gray tiles end your run.{'\n'}
                  • Tap that tile&apos;s column when it overlaps the horizontal amber band (middle of the board).{'\n'}
                  • Too early? Nothing happens — wait until the pale tile lines up with the band; don&apos;t spam the blue
                  lanes randomly.{'\n'}
                  {Platform.OS === 'web' ? '• Web: number keys 1–4 = columns left to right.\n' : ''}
                </Text>
              </View>
              <View style={styles.tapToStartHint} pointerEvents="none">
                <Text style={styles.tapMode}>
                  {h2hSkillContest
                    ? `Head-to-head · vs ${h2hSkillContest.opponentDisplayName} · server-validated score`
                    : dailyTournament
                      ? `Live event · vs ${dailyTournament.opponentDisplayName}`
                      : playMode === 'prize'
                        ? `Prize run · ${PRIZE_RUN_ENTRY_CREDITS} credits · 1 ticket / ${TILE_CLASH_POINTS_PER_TICKET} score`
                        : 'Practice · free'}
                </Text>
                <Text style={styles.tapToStartTitle}>TAP ANYWHERE TO START</Text>
                <Text style={styles.tapToStartSub}>
                  Then tap the column (not the sky above the band) when the good tile crosses the amber band.
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.footerHint, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          Wrong column or bad tile in the band ends the run · Speed increases every 5 good hits
          {Platform.OS === 'web' ? ' · Web: 1–4 = columns' : ''}
        </Text>

        {phase === 'over' && dailyTournament && dailyPayload ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={[styles.card, { maxWidth: dialogMax }]}>
              <GameOverExitRow
                onMinigames={() => router.replace(ROUTE_MINIGAMES)}
                onHome={() => router.replace(ROUTE_HOME)}
              />
              <Text style={styles.goTitle}>Round result</Text>
              <Text style={styles.goVsTile} numberOfLines={1}>
                You vs {dailyTournament.opponentDisplayName}
              </Text>
              <Text style={styles.goScore}>
                {dailyPayload.finalScore.self} — {dailyPayload.finalScore.opponent}
              </Text>
              <Text style={styles.footerHintCenter}>
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
            <View style={[styles.card, { maxWidth: dialogMax }]}>
              <GameOverExitRow
                onMinigames={() => router.replace(ROUTE_MINIGAMES)}
                onHome={() => router.replace(ROUTE_HOME)}
              />
              <Text style={styles.goTitle}>Run ended</Text>
              <Text style={styles.goScore}>Score: {endStatsRef.current.score}</Text>
              {h2hSubmitPhase === 'loading' ? (
                <Text style={styles.footerHintCenter}>Submitting your run…</Text>
              ) : null}
              {h2hSubmitPhase === 'error' ? (
                <>
                  <Text style={styles.footerHintCenter}>Could not submit this run. Check your connection.</Text>
                  <AppButton title="Retry submit" className="mt-3" onPress={() => setH2hRetryKey((k) => k + 1)} />
                </>
              ) : null}
              {h2hSubmitPhase === 'ok' && !h2hPoll?.both_submitted ? (
                <Text style={styles.footerHintCenter}>
                  Waiting for {h2hSkillContest.opponentDisplayName} to finish…
                </Text>
              ) : null}
              {h2hSubmitPhase === 'ok' && h2hPoll?.both_submitted ? (
                <Text style={styles.footerHintCenter}>Both runs in — finalizing match…</Text>
              ) : null}
            </View>
          </View>
        ) : null}
        {phase === 'over' && !dailyTournament && !h2hSkillContest ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={[styles.card, { maxWidth: dialogMax }]}>
              <GameOverExitRow
                onMinigames={() => router.replace(ROUTE_MINIGAMES)}
                onHome={() => router.replace(ROUTE_HOME)}
              />
              <Text style={styles.goTitle}>Run over</Text>
              <Text style={styles.goScore}>Score: {endStatsRef.current.score}</Text>
              {playMode === 'prize' ? (
                <Text style={styles.goTickets}>
                  +{ticketsFromTileClashScore(endStatsRef.current.score)} redeem tickets (this run)
                </Text>
              ) : null}
              <AppButton title="Play Again" onPress={resetRun} className="mb-3" />
              {playMode === 'prize' ? (
                <>
                  {submitting ? (
                    <>
                      <Text style={styles.footerHintCenter}>Saving score…</Text>
                      <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
                    </>
                  ) : null}
                  {submitOk ? <Text style={styles.footerHintCenter}>Score saved.</Text> : null}
                  {submitErr && !submitting ? (
                    <>
                      <Text style={styles.footerHintCenter}>Could not save score.</Text>
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
                      <Text style={styles.footerHintCenter}>Saving practice run…</Text>
                      <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
                    </>
                  ) : null}
                  {submitOk ? (
                    <Text style={styles.footerHintCenter}>Practice run saved (no prize tickets).</Text>
                  ) : null}
                  {submitErr && !submitting ? (
                    <>
                      <Text style={styles.footerHintCenter}>Could not save run.</Text>
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
  safe: { flex: 1, backgroundColor: arcade.navy0 },
  topBar: {
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(56, 189, 248, 0.2)',
    backgroundColor: arcade.navy0,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  backBtnPressed: { opacity: 0.7 },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: arcade.white,
    fontSize: 17,
    fontWeight: '800',
  },
  topBarSpacer: { width: 44 },
  root: { flex: 1, width: '100%' },
  hudRow: {
    alignItems: 'center',
    paddingBottom: 10,
    width: '100%',
  },
  scoreRing: {
    width: 76,
    height: 76,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: '#D4A574',
    backgroundColor: 'rgba(10,22,40,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FACC15',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  scoreRingText: {
    color: arcade.white,
    fontSize: 26,
    fontWeight: '900',
  },
  streakPill: {
    marginTop: 8,
    color: arcade.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  vsOppTile: {
    marginTop: 6,
    color: 'rgba(226, 232, 240, 0.85)',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  goVsTile: {
    color: arcade.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  footerHintCenter: {
    marginTop: 4,
    marginBottom: 14,
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  boardOuter: {
    flex: 1,
    marginHorizontal: 4,
    minHeight: 200,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    backgroundColor: '#071525',
  },
  laneStripes: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  laneCell: {
    borderRightColor: 'rgba(56, 189, 248, 0.22)',
  },
  hitZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.95)',
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  hitZoneReadyHint: {
    color: 'rgba(254, 243, 199, 0.98)',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 15,
  },
  tile: {
    position: 'absolute',
    zIndex: 3,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  redFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(220, 38, 38, 0.42)',
    zIndex: 12,
  },
  laneHitLayer: {
    zIndex: 8,
  },
  columnTouchRow: {
    flexDirection: 'row',
  },
  columnTouchCell: {
    flex: 1,
    height: '100%',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : {}),
  },
  tapToStartLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  rulesBlock: {
    marginHorizontal: 6,
    maxHeight: '52%',
    borderRadius: 12,
    backgroundColor: 'rgba(6, 13, 24, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rulesTitle: {
    color: '#FDE68A',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  rulesBody: {
    color: 'rgba(226, 232, 240, 0.95)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  tapToStartHint: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(6,13,24,0.4)',
  },
  tapMode: {
    color: 'rgba(253, 224, 71, 0.95)',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  tapToStartTitle: {
    color: arcade.gold,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  tapToStartSub: {
    marginTop: 6,
    color: 'rgba(226, 232, 240, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  footerHint: {
    color: arcade.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,13,24,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 40,
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
  practiceNote: {
    marginTop: 8,
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
