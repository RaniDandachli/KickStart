import { COLORS } from '@/minigames/neongrid/constants';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

export function NeonShipResults({
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
  const thrusts = Math.max(0, Math.floor(tapCount));
  const thrustPerDist = score > 0 ? (thrusts / score).toFixed(2) : '—';

  let rating = '—';
  let ratingColor = 'rgba(180,150,90,0.8)';
  if (score > 0) {
    const ratio = thrusts / score;
    if (ratio < 2) {
      rating = 'S';
      ratingColor = COLORS.spiritGold;
    } else if (ratio < 4) {
      rating = 'A';
      ratingColor = '#27AE60';
    } else if (ratio < 7) {
      rating = 'B';
      ratingColor = COLORS.surgeOrange;
    } else {
      rating = 'C';
      ratingColor = 'rgba(200,180,130,0.8)';
    }
  }

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityLabel="Void Glider results">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.column}>
          <View style={styles.topBar}>
            <Pressable onPress={onExit} style={styles.exitBtn} hitSlop={12}>
              <Text style={styles.exitTxt}>← Back</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.kicker}>run complete</Text>
            <Text style={styles.title}>Void Glider</Text>

            <Text style={styles.bigScore}>{score}</Text>
            <Text style={styles.bigScoreLbl}>distance</Text>

            <Text style={[styles.simpleRank, { color: ratingColor }]}>Rank {rating}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{seconds}s</Text>
                <Text style={styles.statLbl}>time</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{thrusts}</Text>
                <Text style={styles.statLbl}>thrusts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{thrustPerDist}</Text>
                <Text style={styles.statLbl}>per dist</Text>
              </View>
            </View>

            {ticketsEarned != null && ticketsEarned > 0 && (
              <View style={styles.ticketBadge}>
                <Text style={styles.ticketTxt}>+{ticketsEarned} tickets earned</Text>
              </View>
            )}

            {h2hFooter}

            <Text style={styles.seed}>Seed {seed}</Text>

            <View style={styles.actionsInScroll}>
              {!hideRematch && (
                <Pressable
                  onPress={onRematch}
                  style={({ pressed }) => [styles.playAgainBtn, pressed && styles.playAgainBtnPressed]}
                >
                  <Text style={styles.playAgainTxt}>Play Again</Text>
                </Pressable>
              )}
              <Pressable
                onPress={onExit}
                style={({ pressed }) => [styles.exitSecondaryBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.exitSecondaryTxt}>Back to Menu</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#080F0E',
    zIndex: 999,
    elevation: 999,
  },
  safe: { flex: 1 },
  column: { flex: 1, flexDirection: 'column', minHeight: 0 },
  topBar: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4,
  },
  exitBtn: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  exitTxt: {
    color: 'rgba(220,190,120,0.75)',
    fontSize: 14,
    fontWeight: '700',
  },
  /** minHeight:0 lets the column shrink so the footer stays on-screen (web + some native flex layouts). */
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 32,
    flexGrow: 1,
  },
  kicker: {
    color: 'rgba(180,150,90,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 0,
  },
  title: {
    color: '#F5E6C0',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bigScore: {
    color: COLORS.spiritGold,
    fontSize: 58,
    fontWeight: '900',
    lineHeight: 62,
  },
  bigScoreLbl: {
    color: 'rgba(180,150,90,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  simpleRank: {
    marginTop: 2,
    marginBottom: 14,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(140,100,40,0.2)',
    borderRadius: 14,
    backgroundColor: 'rgba(14,18,12,0.9)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 10,
    width: '100%',
  },
  statCell: { flex: 1, alignItems: 'center' },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(140,100,40,0.2)',
  },
  statNum: {
    color: '#F5E6C0',
    fontSize: 18,
    fontWeight: '800',
  },
  statLbl: {
    color: 'rgba(160,130,80,0.65)',
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
    borderColor: 'rgba(80,200,170,0.28)',
    marginBottom: 10,
  },
  ticketTxt: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '900',
  },
  seed: {
    color: 'rgba(120,100,60,0.45)',
    fontSize: 10,
    marginTop: 6,
  },
  actionsInScroll: {
    marginTop: 20,
    width: '100%',
    maxWidth: 400,
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,208,80,0.08)',
  },
  playAgainBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surgeOrange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.surgeOrange,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  playAgainBtnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  playAgainTxt: {
    color: '#0A0A0A',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  exitSecondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,208,80,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitSecondaryTxt: {
    color: 'rgba(220,190,120,0.8)',
    fontSize: 14,
    fontWeight: '700',
  },
});