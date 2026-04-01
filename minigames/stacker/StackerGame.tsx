import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { consumePrizeRunEntryCredits, STACKER_PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import {
  awardRedeemTicketsForPrizeRun,
  STACKER_JACKPOT_TICKETS,
  ticketsFromStackerPrizeRun,
} from '@/lib/ticketPayouts';
import { arcade } from '@/lib/arcadeTheme';
import { getSupabase } from '@/supabase/client';
import { useRafLoop } from '@/minigames/core/useRafLoop';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
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
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const insets = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();

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
  const rowH = Math.max(8, Math.floor(gh / (STACKER_WIN_ROWS + 2)));

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
      setPhase('over');
      bump();
    },
    [bump, playMode],
  );

  const step = useCallback(
    (dtMs: number) => {
      const g = gameRef.current;
      if (!g.alive) return;

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

      bump();
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
    setPhase('ready');
    bump();
  }, [bump]);

  const startGame = useCallback(() => {
    if (playMode === 'prize') {
      const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits, STACKER_PRIZE_RUN_ENTRY_CREDITS);
      if (!ok) {
        Alert.alert(
          'Not enough prize credits',
          `Stacker prize runs cost ${STACKER_PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
        );
        return;
      }
    }
    gameRef.current = createGame();
    startTimeRef.current = Date.now();
    tapCountRef.current = 0;
    lastTapAtRef.current = 0;
    wonRef.current = false;
    setSubmitOk(false);
    setPhase('playing');
    bump();
  }, [bump, playMode, profileQ.data?.prize_credits]);

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

  const submitScore = useCallback(async () => {
    const { rows, durationMs } = endStatsRef.current;
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
          game_type: 'stacker' as const,
          score: rows,
          duration_ms: durationMs,
          taps: tapCountRef.current,
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

  const g = gameRef.current;
  const target = stackTarget(g.placed);
  const movingW = target.width;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.shell}>
        {/* Full-screen playfield */}
        <View style={styles.gameFill} onLayout={onGameLayout}>
          <View style={styles.boardWrap}>
            <View style={styles.gridHint}>
              {Array.from({ length: STACKER_GRID_COLS }, (_, i) => (
                <View key={i} style={[styles.gridV, { left: i * unit, width: 1 }]} />
              ))}
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
                      {
                        width: seg.width * unit - 4,
                        height: rowH - 4,
                        left: seg.left * unit + 2,
                        bottom: (idx + 1) * rowH,
                        backgroundColor: tierColor(seg.width),
                        borderColor: 'rgba(248,250,252,0.35)',
                      },
                    ]}
                  />
                ))}
                {phase === 'playing' && g.alive ? (
                  <View
                    style={[
                      styles.block,
                      {
                        width: movingW * unit - 4,
                        height: rowH - 4,
                        left: g.blockLeft * unit + 2,
                        bottom: (g.placed.length + 1) * rowH,
                        backgroundColor: tierColor(movingW),
                        borderColor: '#f8fafc',
                        zIndex: 4,
                        elevation: 6,
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
                    Full screen · tap to drop · {STACKER_WIN_ROWS} rows to jackpot · speed ramps hard
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {phase === 'playing' ? (
              <Pressable style={StyleSheet.absoluteFill} onPress={onStackTap} accessibilityRole="button" accessibilityLabel="Stack block" />
            ) : null}
          </View>
        </View>

        {/* Floating chrome — does not shrink the board */}
        <View style={[styles.floatTop, { paddingTop: 4, paddingLeft: Math.max(insets.left, 6), paddingRight: Math.max(insets.right, 6) }]} pointerEvents="box-none">
          <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}>
            <Ionicons name="chevron-back" size={26} color={arcade.gold} />
            <Text style={styles.backText}>Arcade</Text>
          </Pressable>
          <View style={styles.hudCluster}>
            <Text style={styles.hudTitle}>STACKER</Text>
            <Text style={styles.hudLine}>
              {g.placed.length}/{STACKER_WIN_ROWS} · {tierLabel(target.width)}
            </Text>
            <View style={styles.modePill}>
              <Text style={styles.modePillText}>
                {playMode === 'prize' ? `${STACKER_PRIZE_RUN_ENTRY_CREDITS} cr` : 'Practice'}
              </Text>
            </View>
          </View>
          <View style={{ width: 72 }} />
        </View>

        {phase === 'playing' ? (
          <Text style={[styles.tapHint, { bottom: Math.max(insets.bottom, 10) + 6 }]} pointerEvents="none">
            Tap anywhere to drop
          </Text>
        ) : null}

        {phase === 'over' ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.card}>
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
              <AppButton
                title={submitOk ? 'Score submitted' : 'Submit score'}
                variant="secondary"
                loading={submitting}
                disabled={submitOk || submitting}
                onPress={submitScore}
              />
              {submitting ? <ActivityIndicator color={arcade.gold} style={{ marginTop: 12 }} /> : null}
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: arcade.navy0 },
  shell: { flex: 1, width: '100%', position: 'relative' },
  gameFill: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  boardWrap: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: '#030712',
    overflow: 'hidden',
  },
  gridHint: { ...StyleSheet.absoluteFillObject },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(56,189,248,0.06)',
  },
  tower: { flex: 1, width: '100%', position: 'relative' },
  stackCol: { flex: 1, width: '100%', position: 'relative' },
  block: {
    position: 'absolute',
    borderRadius: 3,
    borderWidth: 2,
  },
  basePad: {
    backgroundColor: 'rgba(51,65,85,0.95)',
    borderColor: 'rgba(148,163,184,0.6)',
  },
  startLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    backgroundColor: 'rgba(6,13,24,0.72)',
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
  floatTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: arcade.gold, fontWeight: '800', fontSize: 15 },
  hudCluster: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
  hudTitle: {
    color: arcade.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 3,
  },
  hudLine: {
    color: 'rgba(226,232,240,0.92)',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  modePill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
  },
  modePillText: { color: 'rgba(226,232,240,0.95)', fontSize: 11, fontWeight: '800' },
  tapHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(148,163,184,0.95)',
    fontSize: 12,
    fontWeight: '700',
    zIndex: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,13,24,0.9)',
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
});
