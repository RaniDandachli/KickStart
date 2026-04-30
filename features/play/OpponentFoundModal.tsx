import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import type { MatchOpponentPreview } from '@/store/matchmakingStore';

const AUTO_DECLINE_SEC_DEFAULT = 30;

function regionLabel(region: string | undefined): string {
  const t = (region ?? '').trim();
  if (!t || t === 'NA') return 'Global';
  return t;
}

function formatPrizeUsd(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

function opponentStats(opp: MatchOpponentPreview | null) {
  if (!opp) {
    return { winsLine: '—', kdLine: '—', winRateLine: '—' };
  }
  const hasFight =
    opp.matchesPlayed != null || opp.wins != null || opp.losses != null;
  if (!hasFight) {
    return { winsLine: '—', kdLine: '—', winRateLine: '—' };
  }
  const w = opp.wins ?? 0;
  const l = opp.losses ?? 0;
  const mp = opp.matchesPlayed ?? 0;
  const winsLine = `${w} Wins`;
  const kdVal = l > 0 ? w / l : w;
  const kdLine = `${kdVal.toFixed(2)} K/D`;
  const winRateLine =
    mp > 0 ? `${Math.round((100 * w) / mp)}% Win Rate` : '—';
  return { winsLine, kdLine, winRateLine };
}

function OpponentFoundBody({
  opponent,
  prizeUsd,
  freeCasual,
  gameSubtitle,
  autoDeclineSec,
  onAccept,
  onDecline,
}: {
  opponent: MatchOpponentPreview | null;
  prizeUsd?: number;
  freeCasual?: boolean;
  gameSubtitle?: string;
  autoDeclineSec: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const insets = useSafeAreaInsets();
  const dismissedRef = useRef(false);
  const onDeclineRef = useRef(onDecline);
  const onAcceptRef = useRef(onAccept);
  onDeclineRef.current = onDecline;
  onAcceptRef.current = onAccept;

  const [secondsLeft, setSecondsLeft] = useState(autoDeclineSec);

  const fireDecline = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDeclineRef.current();
  }, []);

  const fireAccept = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onAcceptRef.current();
  }, []);

  useEffect(() => {
    dismissedRef.current = false;
    let left = autoDeclineSec;
    setSecondsLeft(left);
    const id = setInterval(() => {
      left -= 1;
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(id);
        if (!dismissedRef.current) {
          dismissedRef.current = true;
          onDeclineRef.current();
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [autoDeclineSec]);

  const { winsLine, kdLine, winRateLine } = opponentStats(opponent);
  const rating = opponent?.rating ?? 1500;
  const region = regionLabel(opponent?.region);

  return (
    <View style={[styles.shell, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.backdropStrip} pointerEvents="none">
        <View style={styles.pill}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText}>Opponent found</Text>
        </View>
        {gameSubtitle ? (
          <Text style={styles.gameSubtitle} numberOfLines={2}>
            {gameSubtitle}
          </Text>
        ) : null}
        <View style={styles.hintRow}>
          <View style={styles.hintBullet} />
          <Text style={styles.hintText}>Matched — accept in the modal to open the lobby</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardOuter}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={fireDecline}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
          >
            <SafeIonicons name="close" size={20} color="rgba(255,255,255,0.85)" />
          </Pressable>

          <View style={styles.headerBlock}>
            <LinearGradient
              colors={[runit.neonPurple, runit.purpleDeep]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.trophyRing}
            >
              <SafeIonicons name="trophy" size={34} color={runit.gold} />
            </LinearGradient>
            <Text style={[styles.matchFoundTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>
              MATCH FOUND!
            </Text>
            <View style={styles.subheadRow}>
              <View style={styles.subheadLine} />
              <View style={styles.subheadDiamond} />
              <Text style={styles.subheadText}>Get ready to compete</Text>
              <View style={styles.subheadDiamond} />
              <View style={styles.subheadLine} />
            </View>
          </View>

          {freeCasual ? (
            <View style={styles.casualBox}>
              <Text style={styles.casualTitle}>FREE CASUAL</Text>
              <Text style={styles.casualBody}>No entry fee · no cash prize</Text>
              <Text style={styles.casualFoot}>
                Play for fun — you can still earn Arcade Credits on the Arcade floor (gameplay only — not cash).
              </Text>
            </View>
          ) : prizeUsd != null ? (
            <LinearGradient
              colors={[runit.gold, runit.neonPurple]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.prizeBorder}
            >
              <View style={styles.prizeInner}>
                <Text style={styles.prizeLabel}>🏆 TOP PERFORMER PRIZE</Text>
                <Text style={styles.prizeAmount}>${formatPrizeUsd(prizeUsd)}</Text>
                <Text style={styles.prizeRule}>Best score wins · Run It—listed amount</Text>
                <Text style={styles.prizeFoot}>
                  Not top score? You&apos;ll earn Arcade Credits for the Arcade floor (gameplay only — not cash).
                </Text>
              </View>
            </LinearGradient>
          ) : null}

          {opponent ? (
            <View style={styles.profileBlock}>
              <View style={styles.avatarCol}>
                <LinearGradient
                  colors={[runit.neonPurple, runit.purpleDeep]}
                  style={styles.avatarHex}
                >
                  <View style={styles.avatarInner}>
                    <SafeIonicons name="person" size={40} color="rgba(255,255,255,0.55)" />
                  </View>
                </LinearGradient>
                <View style={styles.ratingBadge}>
                  <SafeIonicons name="star" size={11} color={runit.gold} />
                  <Text style={styles.ratingBadgeText}>{rating}</Text>
                </View>
              </View>
              <Text style={styles.username} numberOfLines={1}>
                {opponent.username}
              </Text>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingMuted}>RATING </Text>
                <Text style={styles.ratingVal}>{rating}</Text>
                <Text style={styles.ratingMuted}> | </Text>
                <SafeIonicons name="globe-outline" size={14} color={runit.neonPurple} />
                <Text style={styles.ratingMuted}> {region}</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <SafeIonicons name="trophy-outline" size={16} color={runit.neonPurple} />
                  <Text style={styles.statText}>{winsLine}</Text>
                </View>
                <View style={styles.statCol}>
                  <SafeIonicons name="radio-button-on" size={16} color={runit.neonPurple} />
                  <Text style={styles.statText}>{kdLine}</Text>
                </View>
                <View style={styles.statCol}>
                  <SafeIonicons name="stats-chart" size={16} color={runit.neonPurple} />
                  <Text style={styles.statText}>{winRateLine}</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.btnRow}>
            <Pressable
              onPress={fireDecline}
              style={({ pressed }) => [styles.btnDecline, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.btnDeclineText, { fontFamily: runitFont.bold }]}>DECLINE</Text>
            </Pressable>
            <Pressable
              onPress={fireAccept}
              style={({ pressed }) => [styles.btnAcceptWrap, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={[runit.neonPurple, runit.neonPink]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.btnAcceptGrad}
              >
                <Text style={[styles.btnAcceptText, { fontFamily: runitFont.black }]}>
                  ACCEPT MATCH
                </Text>
                <SafeIonicons name="chevron-forward" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.timerRow}>
            <SafeIonicons name="time-outline" size={14} color={runit.neonPurple} />
            <Text style={styles.timerText}>Auto decline in {secondsLeft}s</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const webOverlayStyle = StyleSheet.create({
  root: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    backgroundColor: 'rgba(5, 2, 8, 0.88)',
  },
}).root;

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  backdropStrip: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(107, 33, 168, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.45)',
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  pillText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gameSubtitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '900',
    color: 'rgba(148, 163, 184, 0.55)',
    textAlign: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    maxWidth: 320,
  },
  hintBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: runit.gold,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(203, 213, 225, 0.75)',
    lineHeight: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  cardOuter: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(192, 132, 252, 0.55)',
    backgroundColor: runit.bgPanel,
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 20,
    ...runitGlowPinkSoft,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 16,
  },
  trophyRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: runit.neonPurple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 10,
  },
  matchFoundTitle: {
    fontSize: 26,
    letterSpacing: 1.2,
    color: '#fff',
    textAlign: 'center',
  },
  subheadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 14,
    gap: 8,
    paddingHorizontal: 4,
  },
  subheadLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(168, 85, 247, 0.45)',
    minWidth: 16,
  },
  subheadDiamond: {
    width: 5,
    height: 5,
    backgroundColor: runit.neonPurple,
    transform: [{ rotate: '45deg' }],
  },
  subheadText: {
    color: 'rgba(226, 232, 240, 0.88)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  prizeBorder: {
    borderRadius: 14,
    padding: 1.5,
    marginBottom: 16,
  },
  prizeInner: {
    borderRadius: 12,
    backgroundColor: 'rgba(10, 6, 20, 0.96)',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  prizeLabel: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: runit.gold,
  },
  prizeAmount: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
    color: runit.goldBright,
    marginTop: 4,
  },
  prizeRule: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 235, 150, 0.88)',
  },
  prizeFoot: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.65)',
    lineHeight: 14,
  },
  casualBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
    backgroundColor: 'rgba(10, 6, 20, 0.85)',
    padding: 14,
    marginBottom: 16,
  },
  casualTitle: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: runit.neonPurple,
  },
  casualBody: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 14,
    fontWeight: '800',
    color: '#e2e8f0',
  },
  casualFoot: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.62)',
    lineHeight: 14,
  },
  profileBlock: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarCol: {
    marginBottom: 10,
    position: 'relative',
  },
  avatarHex: {
    width: 88,
    height: 88,
    borderRadius: 22,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: runit.neonPurple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarInner: {
    width: 78,
    height: 78,
    borderRadius: 18,
    backgroundColor: 'rgba(5, 2, 12, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    left: -4,
    bottom: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(24, 10, 40, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.5)',
  },
  ratingBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  username: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    maxWidth: '100%',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ratingMuted: {
    color: runit.neonPurple,
    fontSize: 12,
    fontWeight: '700',
  },
  ratingVal: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: 16,
    paddingHorizontal: 4,
    gap: 8,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: 'rgba(226, 232, 240, 0.88)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  btnRow: {
    gap: 10,
  },
  btnDecline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  btnDeclineText: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 1,
  },
  btnAcceptWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  btnAcceptGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  btnAcceptText: {
    color: '#fff',
    fontSize: 15,
    letterSpacing: 0.8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  timerText: {
    color: runit.neonPurple,
    fontSize: 12,
    fontWeight: '700',
  },
});

/** RN `Modal` is often invisible / non-interactive on mobile Safari; use a fixed overlay on web. */
export function OpponentFoundModal({
  visible,
  opponent,
  prizeUsd,
  freeCasual,
  gameSubtitle,
  autoDeclineSec = AUTO_DECLINE_SEC_DEFAULT,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  opponent: MatchOpponentPreview | null;
  /** Listed fixed reward for fee-paid skill contests (optional). */
  prizeUsd?: number;
  /** No fee / no cash prize — casual pairing only. */
  freeCasual?: boolean;
  /** e.g. `1v1 · Shape Dash` — shown behind the card. */
  gameSubtitle?: string;
  /** Countdown before auto-decline (default 30). */
  autoDeclineSec?: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (!visible) return null;

  const body = (
    <OpponentFoundBody
      opponent={opponent}
      prizeUsd={prizeUsd}
      freeCasual={freeCasual}
      gameSubtitle={gameSubtitle}
      autoDeclineSec={autoDeclineSec}
      onAccept={onAccept}
      onDecline={onDecline}
    />
  );

  if (Platform.OS === 'web') {
    return (
      <View style={webOverlayStyle as never} pointerEvents="box-none">
        {body}
      </View>
    );
  }

  return (
    <Modal animationType="fade" transparent visible>
      <View style={stylesModalRn.root}>{body}</View>
    </Modal>
  );
}

const stylesModalRn = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(5, 2, 8, 0.88)',
    justifyContent: 'center',
  },
});
