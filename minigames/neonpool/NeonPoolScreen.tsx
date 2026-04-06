// NeonPoolScreen — 2P 8-ball duel UI (uses EightBallEngine).
// Arcade route can import this screen separately from NeonPoolGame (solo / prize run).

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, {
    useCallback,
    useRef,
    useState
} from 'react';
import {
    Animated,
    Dimensions,
    GestureResponderEvent,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { runFixedPhysicsSteps, useRafLoop } from '@/minigames/core/useRafLoop';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import {
  ballsLeft,
  computeAimLine,
  createEightBallState,
  placeCueBall,
  POCKETS,
  POOL,
  shootCue,
  stepPhysics,
} from './EightBallEngine';
import type { AimLine, Ball, EightBallState, Vec2 } from './EightBallEngine';
  
  // ─── Layout ──────────────────────────────────────────────────────────────────
  const { width: SW, height: SH } = Dimensions.get('window');
  
  // We render the table in landscape-ish aspect. Fit to screen width.
  const TABLE_ASPECT = POOL.tableW / POOL.tableH;
  const TABLE_RENDER_W = Math.min(SW - 0, SH * 0.52);
  const TABLE_RENDER_H = TABLE_RENDER_W / TABLE_ASPECT;
  const SCALE = TABLE_RENDER_W / POOL.tableW;
  
  const sc = (v: number) => v * SCALE;
  
  // ─── NEON PALETTE ────────────────────────────────────────────────────────────
  const N = {
    bg:        '#04090F',
    felt:      '#0A1F14',
    feltLine:  'rgba(16,200,100,0.08)',
    rail:      '#0F2A1A',
    railEdge:  '#1A4A2E',
    railGlow:  'rgba(20,255,120,0.18)',
    neonGreen: '#00FF88',
    neonCyan:  '#00E5FF',
    neonViolet:'#BF5FFF',
    neonAmber: '#FFAB00',
    white:     '#F0F8FF',
    dimText:   'rgba(180,220,200,0.65)',
    danger:    '#FF3B5C',
    gold:      '#FFD700',
  };
  
  // ─── UTILITY ─────────────────────────────────────────────────────────────────
  function lx(v: number) { return sc(v); }
  function ly(v: number) { return sc(v); }
  
  // ─── CUE STICK COMPONENT ─────────────────────────────────────────────────────
  function CueStick({
    cueX, cueY, angle, power, visible,
  }: {
    cueX: number; cueY: number; angle: number; power: number; visible: boolean;
  }) {
    if (!visible) return null;
    const cueLen = sc(90);
    const pullBack = power * sc(28);
    const tipGap = sc(4) + pullBack;
  
    const tx = cueX - Math.cos(angle) * tipGap;
    const ty = cueY - Math.sin(angle) * tipGap;
    const bx = tx - Math.cos(angle) * cueLen;
    const by = ty - Math.sin(angle) * cueLen;
  
    const deg = (angle * 180) / Math.PI;
    const dx = bx - tx;
    const dy = by - ty;
    const len = Math.sqrt(dx * dx + dy * dy);
  
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { zIndex: 20 },
        ]}
      >
        {/* Cue wrap gradient */}
        <View
          style={{
            position: 'absolute',
            left: tx,
            top: ty - sc(3),
            width: len,
            height: sc(6),
            borderRadius: sc(3),
            backgroundColor: 'transparent',
            overflow: 'hidden',
            transform: [{ rotate: `${deg}deg` }],
            transformOrigin: 'left center' as unknown as string,
          }}
        >
          {/* Tip */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: sc(8),
              backgroundColor: '#B8EEC9',
              borderRadius: sc(1),
            }}
          />
          {/* Shaft */}
          <View
            style={{
              position: 'absolute',
              left: sc(8),
              top: sc(0.5),
              bottom: sc(0.5),
              right: sc(12),
              backgroundColor: '#D4A855',
            }}
          />
          {/* Wrap rings */}
          {[0.55, 0.65, 0.75].map((pos, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: len * pos,
                top: 0,
                bottom: 0,
                width: sc(3),
                backgroundColor: 'rgba(30,20,10,0.6)',
              }}
            />
          ))}
          {/* Butt */}
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: sc(12),
              backgroundColor: '#3D1A0A',
              borderRadius: sc(3),
            }}
          />
        </View>
      </View>
    );
  }
  
  // ─── AIM LINE OVERLAY ────────────────────────────────────────────────────────
  function AimOverlay({ line, visible }: { line: AimLine; visible: boolean }) {
    if (!visible) return null;
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 18 }]}>
        {/* Main aim ray */}
        <SvgLine
          x1={line.cueStart.x} y1={line.cueStart.y}
          x2={line.cueTip.x} y2={line.cueTip.y}
          color="rgba(255,255,200,0.55)" width={1.2} dashed
        />
  
        {/* Ghost ball outline */}
        {line.ghostBall && (
          <View
            style={{
              position: 'absolute',
              left: lx(line.ghostBall.x) - sc(POOL.ballR),
              top:  ly(line.ghostBall.y) - sc(POOL.ballR),
              width: sc(POOL.ballR * 2),
              height: sc(POOL.ballR * 2),
              borderRadius: sc(POOL.ballR),
              borderWidth: 1,
              borderColor: 'rgba(255,255,180,0.45)',
              borderStyle: 'dashed',
            }}
          />
        )}
  
        {/* Object ball path */}
        {line.objectBallDir && line.ghostBall && (
          <SvgLine
            x1={line.ghostBall.x} y1={line.ghostBall.y}
            x2={line.objectBallDir.x} y2={line.objectBallDir.y}
            color="rgba(0,229,255,0.55)" width={1.5} dashed
          />
        )}
  
        {/* Deflect path */}
        {line.deflectEnd && (
          <SvgLine
            x1={line.cueTip.x} y1={line.cueTip.y}
            x2={line.deflectEnd.x} y2={line.deflectEnd.y}
            color="rgba(180,180,255,0.3)" width={1} dashed
          />
        )}
      </View>
    );
  }
  
  // Minimal SVG-less line using absolute View transform
  function SvgLine({
    x1, y1, x2, y2, color, width, dashed,
  }: {
    x1: number; y1: number; x2: number; y2: number;
    color: string; width: number; dashed?: boolean;
  }) {
    const dx = lx(x2) - lx(x1);
    const dy = ly(y2) - ly(y1);
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (len < 1) return null;
    return (
      <View
        style={{
          position: 'absolute',
          left: lx(x1),
          top: ly(y1) - width / 2,
          width: len,
          height: width,
          backgroundColor: dashed ? 'transparent' : color,
          borderTopWidth: dashed ? width : 0,
          borderTopColor: color,
          borderStyle: dashed ? 'dashed' : 'solid',
          transform: [{ rotate: `${angle}deg` }],
          transformOrigin: 'left center' as unknown as string,
        }}
      />
    );
  }
  
  // ─── BALL VIEW ────────────────────────────────────────────────────────────────
  function BallView({ ball }: { ball: Ball }) {
    if (ball.pocketed) return null;
    const r = sc(POOL.ballR);
    const isEight = ball.id === 8;
    const isCue = ball.id === 0;
    const isStripe = ball.type === 'stripe';
  
    return (
      <View
        style={{
          position: 'absolute',
          left: lx(ball.x) - r,
          top:  ly(ball.y) - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          overflow: 'hidden',
          backgroundColor: isCue ? '#FFFFFF' : isEight ? '#1A1A2E' : ball.color,
          borderWidth: 0.5,
          borderColor: 'rgba(255,255,255,0.25)',
          shadowColor: isCue ? '#FFFFFF' : isEight ? '#6644FF' : ball.color,
          shadowOpacity: 0.7,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
          zIndex: 15,
        }}
      >
        {/* Stripe band */}
        {isStripe && (
          <View
            style={{
              position: 'absolute',
              left: 0, right: 0,
              top: r * 0.28,
              height: r * 0.85,
              backgroundColor: '#F8F8F8',
              opacity: 0.9,
            }}
          />
        )}
        {/* Number circle */}
        {!isCue && (
          <View
            style={{
              position: 'absolute',
              width: r * 0.9,
              height: r * 0.9,
              borderRadius: r * 0.45,
              backgroundColor: isEight ? '#FFFFFF' : isCue ? 'transparent' : '#FFFFFFCC',
              top: r * 0.55,
              left: r * 0.55,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: r * 0.6,
                fontWeight: '900',
                color: isEight ? '#000' : ball.color,
                lineHeight: r * 0.7,
              }}
            >
              {ball.id}
            </Text>
          </View>
        )}
        {/* Highlight */}
        <View
          style={{
            position: 'absolute',
            width: r * 0.55,
            height: r * 0.45,
            borderRadius: r * 0.28,
            backgroundColor: 'rgba(255,255,255,0.35)',
            top: r * 0.12,
            left: r * 0.18,
            transform: [{ rotate: '-30deg' }],
          }}
        />
      </View>
    );
  }
  
  // ─── FELT PATTERN ────────────────────────────────────────────────────────────
  function FeltLines({ w, h }: { w: number; h: number }) {
    const lines = [];
    const spacing = sc(30);
    for (let x = 0; x < w; x += spacing) {
      lines.push(
        <View key={`v${x}`} style={{ position: 'absolute', left: x, top: 0, width: 1, height: h, backgroundColor: N.feltLine }} />,
      );
    }
    for (let y = 0; y < h; y += spacing) {
      lines.push(
        <View key={`h${y}`} style={{ position: 'absolute', left: 0, top: y, width: w, height: 1, backgroundColor: N.feltLine }} />,
      );
    }
    return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{lines}</View>;
  }
  
  // ─── POWER BAR ────────────────────────────────────────────────────────────────
  function PowerBar({ power }: { power: number }) {
    const segments = 10;
    return (
      <View style={styles.powerBarWrap}>
        <Text style={styles.powerLabel}>POWER</Text>
        <View style={styles.powerTrack}>
          {Array.from({ length: segments }, (_, i) => {
            const threshold = (i + 1) / segments;
            const filled = power >= threshold - 0.001;
            const color = power > 0.8 ? N.danger : power > 0.5 ? N.neonAmber : N.neonGreen;
            return (
              <View
                key={i}
                style={[
                  styles.powerSeg,
                  {
                    backgroundColor: filled ? color : 'rgba(255,255,255,0.08)',
                    shadowColor: filled ? color : 'transparent',
                    shadowOpacity: filled ? 0.8 : 0,
                    shadowRadius: 4,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>
    );
  }
  
  // ─── PLAYER HUD ──────────────────────────────────────────────────────────────
  function PlayerHUD({
    state, scale,
  }: {
    state: EightBallState;
    scale: number;
  }) {
    const left = ballsLeft(state, state.groupP1);
    const right = ballsLeft(state, state.groupP2);
  
    return (
      <View style={styles.hud}>
        <View style={[styles.hudPlayer, state.currentPlayer === 1 && styles.hudActive]}>
          <View style={[styles.hudDot, { backgroundColor: '#F97316' }]} />
          <Text style={styles.hudName}>P1</Text>
          <Text style={styles.hudGroup}>
            {state.groupP1 ? state.groupP1.toUpperCase() : '?'}
          </Text>
          <Text style={styles.hudCount}>{left}</Text>
        </View>
  
        <View style={styles.hudCenter}>
          {state.foul && (
            <Text style={styles.foulText}>
              FOUL: {state.foul.replace('_', ' ').toUpperCase()}
            </Text>
          )}
          <Text style={styles.hudClock}>
            {state.phase === 'ball_in_hand' ? 'BALL IN HAND' : ''}
          </Text>
        </View>
  
        <View style={[styles.hudPlayer, state.currentPlayer === 2 && styles.hudActive]}>
          <View style={[styles.hudDot, { backgroundColor: '#6366F1' }]} />
          <Text style={styles.hudName}>P2</Text>
          <Text style={styles.hudGroup}>
            {state.groupP2 ? state.groupP2.toUpperCase() : '?'}
          </Text>
          <Text style={styles.hudCount}>{right}</Text>
        </View>
      </View>
    );
  }
  
  // ─── SPIN PICKER ─────────────────────────────────────────────────────────────
  function SpinPicker({
    value, onChange,
  }: {
    value: number; onChange: (v: number) => void;
  }) {
    const SIZE = 52;
    return (
      <View style={styles.spinWrap}>
        <Text style={styles.spinLabel}>SPIN</Text>
        <Pressable
          style={[styles.spinBall, { width: SIZE, height: SIZE, borderRadius: SIZE / 2 }]}
          onPress={(e) => {
            const rx = (e.nativeEvent.locationX / SIZE) * 2 - 1;
            const ry = (e.nativeEvent.locationY / SIZE) * 2 - 1;
            onChange(Math.max(-1, Math.min(1, rx)));
          }}
        >
          <View
            style={[
              styles.spinDot,
              {
                left: SIZE / 2 + (value * SIZE * 0.35) - 5,
                top: SIZE / 2 - 5,
              },
            ]}
          />
        </Pressable>
      </View>
    );
  }
  
  // ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function NeonPoolScreen() {
    useHidePlayTabBar();
    const router = useRouter();
  
    const stateRef = useRef<EightBallState>(createEightBallState());
    const [, setTick] = useState(0);
    const bump = useCallback(() => setTick((t) => t + 1), []);
  
    // Aiming gesture state
    const aimStartRef = useRef<Vec2 | null>(null);
    const isDraggingRef = useRef(false);
    const [localAngle, setLocalAngle] = useState(Math.PI);
    const [localPower, setLocalPower] = useState(0.5);
    const [localSpin, setLocalSpin] = useState(0);
    const [phase, setPhase] = useState<'intro' | 'playing' | 'over'>('intro');
    const winnerRef = useRef<1 | 2 | null>(null);
  
    // Win flash animation
    const flashAnim = useRef(new Animated.Value(0)).current;
  
    const loop = useCallback(
      (totalDtMs: number) => {
        const s = stateRef.current;
        let hitGameOver = false;
        if (s.phase === 'shot_in_progress') {
          runFixedPhysicsSteps(totalDtMs, (h) => {
            const cur = stateRef.current;
            if (!cur || cur.phase !== 'shot_in_progress') return false;
            stepPhysics(cur, h);
            const after = stateRef.current;
            if (!after || after.phase !== 'shot_in_progress') {
              hitGameOver = after?.phase === 'game_over';
              return false;
            }
            return true;
          });
        }
        if (hitGameOver) {
          const after = stateRef.current;
          winnerRef.current = after.winner;
          setPhase('over');
          Animated.sequence([
            Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          ]).start();
        }
        bump();
      },
      [bump, flashAnim],
    );
  
    useRafLoop(loop, phase === 'playing');
  
    const startGame = useCallback(() => {
      stateRef.current = createEightBallState();
      setLocalAngle(Math.PI);
      setLocalPower(0.5);
      setLocalSpin(0);
      setPhase('playing');
      bump();
    }, [bump]);
  
    // ── Gesture handlers ──────────────────────────────────────────────────────
    // The table Pressable captures drag to aim + set power
  
    const onTableTouchStart = useCallback((e: GestureResponderEvent) => {
      const s = stateRef.current;
      if (s.phase === 'shot_in_progress') return;
  
      const tx = e.nativeEvent.locationX / SCALE;
      const ty = e.nativeEvent.locationY / SCALE;
  
      if (s.phase === 'ball_in_hand') {
        placeCueBall(s, tx, ty);
        bump();
        return;
      }
  
      // Start aim drag
      aimStartRef.current = { x: tx, y: ty };
      isDraggingRef.current = true;
    }, [bump]);
  
    const onTableTouchMove = useCallback((e: GestureResponderEvent) => {
      if (!isDraggingRef.current || !aimStartRef.current) return;
      const s = stateRef.current;
      if (s.phase !== 'aiming') return;
  
      const cue = s.balls.find((b) => b.id === 0);
      if (!cue) return;
  
      const tx = e.nativeEvent.locationX / SCALE;
      const ty = e.nativeEvent.locationY / SCALE;
  
      // Angle: from current touch toward cue ball
      const dx = cue.x - tx;
      const dy = cue.y - ty;
      const angle = Math.atan2(dy, dx);
  
      // Power: distance from start
      const pullDx = tx - aimStartRef.current.x;
      const pullDy = ty - aimStartRef.current.y;
      const pull = Math.sqrt(pullDx * pullDx + pullDy * pullDy);
      const power = Math.min(1, pull / (POOL.tableW * 0.22));
  
      setLocalAngle(angle);
      setLocalPower(power);
      s.aimAngle = angle;
      s.aimPower = power;
    }, []);
  
    const onTableTouchEnd = useCallback(() => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const s = stateRef.current;
      if (s.phase !== 'aiming') return;
      shootCue(s, localAngle, localPower, localSpin);
      bump();
    }, [localAngle, localPower, localSpin, bump]);
  
    const s = stateRef.current;
    const aimLine = computeAimLine(s, localAngle);
    const cueBall = s.balls.find((b) => b.id === 0);
    const isAiming = s.phase === 'aiming' && phase === 'playing';
    const isMoving = s.phase === 'shot_in_progress';
  
    // ── INTRO ─────────────────────────────────────────────────────────────────
    if (phase === 'intro') {
      return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <LinearGradient colors={['#04090F', '#0A1F14', '#04090F']} style={styles.introWrap}>
            <Text style={styles.introTitle}>8 BALL{'\n'}POOL</Text>
            <Text style={styles.introBadge}>RUN IT ARCADE</Text>
            <Text style={styles.introSub}>
              Skill-based duel · Drag to aim · Pull back to power
            </Text>
            <View style={styles.ruleRow}>
              {['Pocket your group', 'Then sink the 8', 'Foul = ball-in-hand'].map((r) => (
                <View key={r} style={styles.ruleChip}>
                  <Text style={styles.ruleText}>{r}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.ctaBtn} onPress={startGame}>
              <LinearGradient
                colors={[N.neonGreen, '#00BB66']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGrad}
              >
                <Text style={styles.ctaLabel}>BREAK & PLAY</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </SafeAreaView>
      );
    }
  
    // ── GAME OVER ─────────────────────────────────────────────────────────────
    if (phase === 'over') {
      return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <LinearGradient colors={['#04090F', '#0A1F14', '#04090F']} style={styles.introWrap}>
            <Animated.View style={{ opacity: flashAnim.interpolate({ inputRange: [0,1], outputRange: [0.3, 1] }) }}>
              <Text style={[styles.introTitle, { color: winnerRef.current === 1 ? N.neonGreen : N.neonViolet }]}>
                {winnerRef.current === 1 ? 'YOU WIN!' : 'P2 WINS!'}
              </Text>
            </Animated.View>
            <Text style={styles.introSub}>Shots: {s.shotCount}  ·  Turns: {s.turnCount}</Text>
            <View style={{ height: 32 }} />
            <Pressable style={styles.ctaBtn} onPress={startGame}>
              <LinearGradient
                colors={[N.neonGreen, '#00BB66']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGrad}
              >
                <Text style={styles.ctaLabel}>REMATCH</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setPhase('intro')} style={{ marginTop: 16 }}>
              <Text style={styles.dimLink}>← Back to menu</Text>
            </Pressable>
          </LinearGradient>
        </SafeAreaView>
      );
    }
  
    // ── PLAYING ───────────────────────────────────────────────────────────────
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={N.dimText} />
          </Pressable>
          <Text style={styles.topTitle}>8 BALL POOL</Text>
          <View style={{ width: 40 }} />
        </View>
  
        {/* Player HUD */}
        <PlayerHUD state={s} scale={SCALE} />
  
        {/* TABLE */}
        <View style={styles.tableContainer}>
          {/* Rail shadow border */}
          <View
            style={[
              styles.tableRail,
              {
                width: TABLE_RENDER_W + sc(POOL.cushion) * 2,
                height: TABLE_RENDER_H + sc(POOL.cushion) * 2,
              },
            ]}
          >
            {/* Felt surface */}
            <Pressable
              onPressIn={onTableTouchStart}
              onTouchMove={onTableTouchMove as unknown as (e: GestureResponderEvent) => void}
              onPressOut={onTableTouchEnd}
              style={[
                styles.feltSurface,
                { width: TABLE_RENDER_W, height: TABLE_RENDER_H },
              ]}
            >
              <LinearGradient
                colors={['#0D2618', '#0A1F14', '#0C2416']}
                style={StyleSheet.absoluteFill}
              />
              <FeltLines w={TABLE_RENDER_W} h={TABLE_RENDER_H} />
  
              {/* Center spot */}
              <View style={[styles.centerSpot, { left: TABLE_RENDER_W / 2 - 2, top: TABLE_RENDER_H / 2 - 2 }]} />
  
              {/* Pockets */}
              {POCKETS.map((p, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: lx(p.x) - sc(POOL.pocketVisR),
                    top:  ly(p.y) - sc(POOL.pocketVisR),
                    width: sc(POOL.pocketVisR * 2),
                    height: sc(POOL.pocketVisR * 2),
                    borderRadius: sc(POOL.pocketVisR),
                    backgroundColor: '#000000',
                    borderWidth: 1,
                    borderColor: 'rgba(0,255,120,0.3)',
                    zIndex: 1,
                  }}
                />
              ))}
  
              {/* Aim overlay */}
              {isAiming && !isMoving && (
                <AimOverlay line={aimLine} visible />
              )}
  
              {/* Balls */}
              {s.balls.map((ball) => (
                <BallView key={ball.id} ball={ball} />
              ))}
  
              {/* Cue stick */}
              {isAiming && cueBall && !cueBall.pocketed && (
                <CueStick
                  cueX={lx(cueBall.x)}
                  cueY={ly(cueBall.y)}
                  angle={localAngle}
                  power={localPower}
                  visible
                />
              )}
  
              {/* Ball-in-hand indicator */}
              {s.phase === 'ball_in_hand' && (
                <View style={styles.bihBanner} pointerEvents="none">
                  <Text style={styles.bihText}>TAP TABLE TO PLACE CUE BALL</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
  
        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <SpinPicker value={localSpin} onChange={(v) => setLocalSpin(v)} />
          <PowerBar power={localPower} />
          <View style={styles.turnBadge}>
            <View style={[styles.turnDot, { backgroundColor: s.currentPlayer === 1 ? '#F97316' : '#6366F1' }]} />
            <Text style={styles.turnText}>P{s.currentPlayer} TURN</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }
  
  // ─── STYLES ───────────────────────────────────────────────────────────────────
  const styles = StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: N.bg,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topTitle: {
      color: N.neonGreen,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 3,
      textShadowColor: N.neonGreen,
      textShadowRadius: 8,
      textShadowOffset: { width: 0, height: 0 },
    },
    hud: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderColor: 'rgba(0,255,120,0.12)',
    },
    hudPlayer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      opacity: 0.45,
      padding: 6,
      borderRadius: 8,
    },
    hudActive: {
      opacity: 1,
      backgroundColor: 'rgba(0,255,120,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(0,255,120,0.25)',
    },
    hudDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    hudName: {
      color: N.white,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1,
    },
    hudGroup: {
      color: N.dimText,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
    },
    hudCount: {
      color: N.neonAmber,
      fontSize: 16,
      fontWeight: '900',
      marginLeft: 'auto',
    },
    hudCenter: {
      flex: 1,
      alignItems: 'center',
    },
    foulText: {
      color: N.danger,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
      textAlign: 'center',
    },
    hudClock: {
      color: N.neonCyan,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1,
    },
    tableContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tableRail: {
      borderRadius: sc(10),
      backgroundColor: N.rail,
      borderWidth: sc(3),
      borderColor: N.railEdge,
      padding: sc(POOL.cushion * 0.5),
      shadowColor: N.neonGreen,
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
      elevation: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    feltSurface: {
      borderRadius: sc(6),
      overflow: 'hidden',
      position: 'relative',
    },
    centerSpot: {
      position: 'absolute',
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.2)',
      zIndex: 2,
    },
    bihBanner: {
      position: 'absolute',
      bottom: 8,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 30,
    },
    bihText: {
      color: N.neonAmber,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.5,
      backgroundColor: 'rgba(10,15,20,0.85)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: N.neonAmber,
      overflow: 'hidden',
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderColor: 'rgba(0,255,120,0.1)',
      gap: 12,
    },
    powerBarWrap: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    powerLabel: {
      color: N.dimText,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 2,
    },
    powerTrack: {
      flexDirection: 'row',
      gap: 2,
    },
    powerSeg: {
      width: 14,
      height: 8,
      borderRadius: 2,
    },
    spinWrap: {
      alignItems: 'center',
      gap: 4,
    },
    spinLabel: {
      color: N.dimText,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 2,
    },
    spinBall: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(0,229,255,0.3)',
      position: 'relative',
      overflow: 'hidden',
    },
    spinDot: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: N.neonCyan,
      shadowColor: N.neonCyan,
      shadowOpacity: 1,
      shadowRadius: 4,
    },
    turnBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    turnDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    turnText: {
      color: N.white,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.5,
    },
  
    // Intro / Over screens
    introWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 16,
    },
    introTitle: {
      color: N.neonGreen,
      fontSize: 52,
      fontWeight: '900',
      letterSpacing: 6,
      textAlign: 'center',
      textShadowColor: N.neonGreen,
      textShadowRadius: 20,
      textShadowOffset: { width: 0, height: 0 },
      lineHeight: 58,
    },
    introBadge: {
      color: N.neonAmber,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 4,
      borderWidth: 1,
      borderColor: N.neonAmber,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 4,
    },
    introSub: {
      color: N.dimText,
      fontSize: 14,
      textAlign: 'center',
      fontWeight: '500',
      lineHeight: 22,
    },
    ruleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    ruleChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor: 'rgba(0,255,120,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(0,255,120,0.25)',
    },
    ruleText: {
      color: N.neonGreen,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    ctaBtn: {
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: N.neonGreen,
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 10,
      marginTop: 8,
    },
    ctaGrad: {
      paddingHorizontal: 48,
      paddingVertical: 16,
      borderRadius: 12,
    },
    ctaLabel: {
      color: '#000',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 3,
      textAlign: 'center',
    },
    dimLink: {
      color: N.dimText,
      fontSize: 14,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
  });