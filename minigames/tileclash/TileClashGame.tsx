import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import {
  awardRedeemTicketsForPrizeRun,
  TILE_CLASH_POINTS_PER_TICKET,
  ticketsFromTileClashScore,
} from '@/lib/ticketPayouts';
import { arcade } from '@/lib/arcadeTheme';
import { getSupabase } from '@/supabase/client';
import { useRafLoop } from '@/minigames/core/useRafLoop';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';

const COLS = 4;
/** Abstract vertical range (game logic). */
const LANE_H = 200;
const TILE_H = 22;
const HIT_TOP = 128;
const HIT_BOTTOM = 178;
const BASE_SCROLL = 0.056;
const SPAWN_MS = 520;
const SPEED_BUMP = 1.12;

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
  return y + TILE_H > HIT_TOP && y < HIT_BOTTOM;
}

function findTileInColumn(tiles: Tile[], col: number): Tile | undefined {
  let best: Tile | undefined;
  let bestY = -1e9;
  for (const t of tiles) {
    if (t.col !== col || !inHitOverlap(t.y)) continue;
    if (t.y > bestY) {
      bestY = t.y;
      best = t;
    }
  }
  return best;
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

export default function TileClashGame({ playMode = 'practice' }: { playMode?: 'practice' | 'prize' }) {
  useHidePlayTabBar();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const { width: sw } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [boardSize, setBoardSize] = useState({ w: Math.max(200, sw - 16), h: 0 });

  const boardW = boardSize.w;
  const boardH = boardSize.h > 0 ? boardSize.h : 360;
  const scaleY = boardH / LANE_H;
  const colW = boardW / COLS;

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const [, setUiTick] = useState(0);
  const modelRef = useRef<GameModel>(createGame());
  const startTimeRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const intervalsRef = useRef<number[]>([]);
  const tapCountRef = useRef(0);
  const endStatsRef = useRef({ score: 0, durationMs: 0, taps: 0, intervals: [] as number[] });
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);
  const [redFlash, setRedFlash] = useState(false);

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
      if (playMode === 'prize') {
        awardRedeemTicketsForPrizeRun(ticketsFromTileClashScore(m.score));
      }
      setPhase('over');
      bump();
    },
    [bump, playMode],
  );

  const step = useCallback(
    (dtMs: number) => {
      const m = modelRef.current;
      if (!m.alive) return;

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
          return;
        }
      }

      m.tiles = m.tiles.filter((t) => t.y < LANE_H + 24);
      bump();
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
    setSubmitOk(false);
    setPhase('ready');
    bump();
  }, [bump]);

  const startGame = useCallback(() => {
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
    const m = createGame();
    spawnRow(m, HIT_TOP - 14);
    modelRef.current = m;
    startTimeRef.current = Date.now();
    lastTapAtRef.current = 0;
    intervalsRef.current = [];
    tapCountRef.current = 0;
    setSubmitOk(false);
    setPhase('playing');
    bump();
  }, [bump, playMode]);

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

  const submitScore = useCallback(async () => {
    const { score, durationMs, taps, intervals } = endStatsRef.current;
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
          game_type: 'tile_clash' as const,
          score,
          duration_ms: durationMs,
          taps,
          tap_intervals_ms: intervals,
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
  const hitTopPx = HIT_TOP * scaleY;
  const hitH = (HIT_BOTTOM - HIT_TOP) * scaleY;
  const mult = 1 + Math.floor(m.streak / 10);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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
        </View>

        <View
          style={styles.boardOuter}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) {
              setBoardSize({ w: width, h: height });
            }
          }}
        >
          {/* Lane backgrounds + vertical dividers (reference: 4 navy lanes) */}
          <View style={styles.laneStripes}>
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

          <View style={[styles.hitZone, { top: hitTopPx, height: hitH }]} />

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
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {Array.from({ length: COLS }, (_, col) => (
                <Pressable
                  key={col}
                  style={[styles.laneHit, { left: col * colW, width: colW }]}
                  onPress={() => onColumnPress(col)}
                />
              ))}
            </View>
          ) : null}

          {/* Tap anywhere to start — does not hide the gold band */}
          {phase === 'ready' ? (
            <Pressable style={styles.tapToStartLayer} onPress={startGame}>
              <View style={styles.tapToStartHint} pointerEvents="none">
                <Text style={styles.tapMode}>
                  {playMode === 'prize'
                    ? `Prize run · ${PRIZE_RUN_ENTRY_CREDITS} credits · 1 ticket / ${TILE_CLASH_POINTS_PER_TICKET} score`
                    : 'Practice · free'}
                </Text>
                <Text style={styles.tapToStartTitle}>TAP TO START</Text>
                <Text style={styles.tapToStartSub}>Hit the glowing tile in the gold zone</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.footerHint, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          Wrong tile or miss ends the run · Speed up every 5 hits
        </Text>

        {phase === 'over' ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.card}>
              <Text style={styles.goTitle}>Run over</Text>
              <Text style={styles.goScore}>Score: {endStatsRef.current.score}</Text>
              {playMode === 'prize' ? (
                <Text style={styles.goTickets}>
                  +{ticketsFromTileClashScore(endStatsRef.current.score)} redeem tickets (this run)
                </Text>
              ) : null}
              <AppButton title="Play Again" onPress={resetRun} className="mb-3" />
              <AppButton
                title={submitOk ? 'Score submitted' : 'Submit Score'}
                variant="secondary"
                loading={submitting}
                disabled={submitOk || submitting}
                onPress={submitScore}
              />
              {submitting ? (
                <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} />
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: arcade.navy0 },
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
  boardOuter: {
    flex: 1,
    marginHorizontal: 8,
    minHeight: 200,
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
  laneHit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 8,
  },
  tapToStartLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
    justifyContent: 'flex-end',
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
    maxWidth: 360,
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
