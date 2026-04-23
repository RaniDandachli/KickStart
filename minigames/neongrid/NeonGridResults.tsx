import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  finalScore: number;
  durationMs: number;
  tapCount: number;
  seed: number;
  ticketsEarned?: number;
  hideRematch?: boolean;
  h2hFooter?: ReactNode;
  onRematch: () => void;
  onExit: () => void;
};

export function NeonGridResults({
  visible,
  finalScore,
  durationMs,
  tapCount,
  seed,
  ticketsEarned,
  hideRematch,
  h2hFooter,
  onRematch,
  onExit,
}: Props) {
  if (!visible) return null;

  const score = Math.max(0, Math.floor(finalScore));
  const seconds = (durationMs / 1000).toFixed(1);
  const moves = Math.max(0, Math.floor(tapCount));

  // Efficiency rating
  let rating = '—';
  if (score > 0) {
    const stepsPerRow = moves / score;
    if (stepsPerRow < 1.4) rating = 'S';
    else if (stepsPerRow < 1.8) rating = 'A';
    else if (stepsPerRow < 2.5) rating = 'B';
    else rating = 'C';
  }

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      {/* Atmospheric glow */}
      <View style={styles.glowTop} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={onExit} style={styles.exit}>
            <Text style={styles.exitTxt}>← Back</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* Fox icon */}
          <View style={styles.foxWrap}>
            <View style={styles.foxGlow} />
            <Text style={styles.foxEmoji}>✦</Text>
          </View>

          <Text style={styles.kicker}>journey complete</Text>
          <Text style={styles.title}>Spirit Cross</Text>

          {/* Main stat */}
          <View style={styles.mainStat}>
            <Text style={styles.mainStatNum}>{score}</Text>
            <Text style={styles.mainStatLbl}>steps crossed</Text>
          </View>

          {/* Rating badge */}
          <View style={[styles.ratingBadge, rating === 'S' && styles.ratingS]}>
            <Text style={[styles.ratingTxt, rating === 'S' && styles.ratingSText]}>
              {rating}
            </Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{seconds}s</Text>
              <Text style={styles.statLbl}>time</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{moves}</Text>
              <Text style={styles.statLbl}>moves</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statNum}>
                {score > 0 ? (moves / score).toFixed(1) : '—'}
              </Text>
              <Text style={styles.statLbl}>moves/row</Text>
            </View>
          </View>

          {ticketsEarned != null && ticketsEarned > 0 ? (
            <View style={styles.ticketBadge}>
              <Text style={styles.ticketTxt}>+{ticketsEarned} tickets earned</Text>
            </View>
          ) : null}

          {h2hFooter}

          <Text style={styles.seed}>Seed {seed}</Text>

          {!hideRematch ? (
            <Pressable onPress={onRematch} style={({ pressed }) => [styles.rematchBtn, pressed && styles.rematchBtnPressed]}>
              <Text style={styles.rematchTxt}>Play Again</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#07100F',
    zIndex: 50,
  },
  glowTop: {
    position: 'absolute',
    top: -60,
    left: '20%',
    right: '20%',
    height: 220,
    borderRadius: 110,
    backgroundColor: '#FF8C00',
    opacity: 0.06,
  },
  safe: { flex: 1 },
  topBar: { paddingHorizontal: 12, paddingTop: 4 },
  exit: { alignSelf: 'flex-start', padding: 8 },
  exitTxt: { color: 'rgba(220,190,120,0.85)', fontSize: 15, fontWeight: '700' },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },

  foxWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  foxGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFD700',
    opacity: 0.12,
    shadowColor: '#FFD700',
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  foxEmoji: {
    fontSize: 32,
    color: '#FFD700',
    textShadowColor: '#FF8C00',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },

  kicker: {
    color: 'rgba(180,150,90,0.8)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: '#F5E6C0',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 20,
    letterSpacing: 1,
  },

  mainStat: { alignItems: 'center', marginBottom: 6 },
  mainStatNum: {
    color: '#FFD700',
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 76,
    textShadowColor: '#FF8C00',
    textShadowRadius: 20,
    textShadowOffset: { width: 0, height: 0 },
  },
  mainStatLbl: {
    color: 'rgba(180,150,90,0.8)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  ratingBadge: {
    marginTop: 8,
    marginBottom: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(60,45,15,0.9)',
    borderWidth: 2,
    borderColor: 'rgba(180,140,60,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingS: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.1)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  ratingTxt: {
    color: 'rgba(220,180,100,0.9)',
    fontSize: 20,
    fontWeight: '900',
  },
  ratingSText: { color: '#FFD700' },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(140,100,40,0.2)',
    borderRadius: 12,
    backgroundColor: 'rgba(20,16,8,0.8)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
    width: '100%',
  },
  statCell: { flex: 1, alignItems: 'center' },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(140,100,40,0.2)',
  },
  statNum: {
    color: '#F5E6C0',
    fontSize: 18,
    fontWeight: '800',
  },
  statLbl: {
    color: 'rgba(160,130,80,0.75)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  ticketBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(20,50,45,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(80,200,170,0.3)',
    marginBottom: 12,
  },
  ticketTxt: {
    color: '#5eead4',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  seed: {
    color: 'rgba(120,100,60,0.6)',
    fontSize: 11,
    marginTop: 6,
    marginBottom: 16,
  },

  rematchBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  rematchBtnPressed: { opacity: 0.8 },
  rematchTxt: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});