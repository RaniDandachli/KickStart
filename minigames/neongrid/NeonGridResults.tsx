import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from './constants';

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
  const movesPerRow = score > 0 ? (moves / score).toFixed(1) : '—';

  // Efficiency rating
  let rating = '—';
  let ratingColor = 'rgba(180,150,90,0.8)';
  if (score > 0) {
    const ratio = moves / score;
    if (ratio < 1.4)      { rating = 'S'; ratingColor = COLORS.spiritGold; }
    else if (ratio < 1.8) { rating = 'A'; ratingColor = '#27AE60'; }
    else if (ratio < 2.5) { rating = 'B'; ratingColor = COLORS.surgeOrange; }
    else                  { rating = 'C'; ratingColor = 'rgba(200,180,130,0.8)'; }
  }

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityLabel="Street Dash results">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>

        {/* Top bar — always visible */}
        <View style={styles.topBar}>
          <Pressable onPress={onExit} style={styles.exitBtn} hitSlop={12}>
            <Text style={styles.exitTxt}>← Back</Text>
          </Pressable>
        </View>

        {/* Scrollable content — so nothing gets cut off on small screens */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Text style={styles.kicker}>run complete</Text>
          <Text style={styles.title}>Street Dash</Text>

          {/* Score */}
          <Text style={styles.bigScore}>{score}</Text>
          <Text style={styles.bigScoreLbl}>blocks crossed</Text>

          <Text style={[styles.simpleRank, { color: ratingColor }]}>Rank {rating}</Text>

          {/* Stats */}
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
              <Text style={styles.statNum}>{movesPerRow}</Text>
              <Text style={styles.statLbl}>moves/row</Text>
            </View>
          </View>

          {ticketsEarned != null && ticketsEarned > 0 && (
            <View style={styles.ticketBadge}>
              <Text style={styles.ticketTxt}>+{ticketsEarned} tickets earned</Text>
            </View>
          )}

          {h2hFooter}

          <Text style={styles.seed}>Seed {seed}</Text>
        </ScrollView>

        {/* Action buttons — always pinned at bottom, never scroll away */}
        <View style={styles.actions}>
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

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#06040c',
    zIndex: 50,
  },
  safe: {
    flex: 1,
  },

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
    color: 'rgba(196,181,253,0.85)',
    fontSize: 14,
    fontWeight: '700',
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 12,
  },

  kicker: {
    color: COLORS.neonPurple,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 0,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 8,
  },

  bigScore: {
    color: COLORS.hudGold,
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
    borderColor: 'rgba(147,51,234,0.35)',
    borderRadius: 14,
    backgroundColor: 'rgba(14,12,24,0.92)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 12,
    width: '100%',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(147,51,234,0.25)',
  },
  statNum: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  statLbl: {
    color: COLORS.hudMuted,
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
    color: '#5eead4',
    fontSize: 14,
    fontWeight: '900',
  },

  seed: {
    color: 'rgba(148,163,184,0.4)',
    fontSize: 10,
    marginTop: 6,
  },

  // ── Bottom action buttons ──────────────────────────────────────────
  actions: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 22,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(147,51,234,0.35)',
    backgroundColor: '#06040c',
  },

  // Primary: Play Again — high contrast (dark-on-purple failed if bg didn’t paint on some builds)
  playAgainBtn: {
    width: '100%',
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: '#7C3AED',
    borderWidth: 2,
    borderColor: 'rgba(250,250,250,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    shadowColor: '#A855F7',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  playAgainBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
    backgroundColor: '#6D28D9',
  },
  playAgainTxt: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  // Secondary: Back to Menu — outlined, less prominent
  exitSecondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(147,51,234,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitSecondaryTxt: {
    color: COLORS.hudMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});