import { usePathname, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { H2H_QUICK_MATCH_GAME_KEY } from '@/lib/homeOpenMatches';
import { useMatchmakingStore } from '@/store/matchmakingStore';

function buildQueueHref(snapshot: {
  mode: 'casual' | 'ranked' | 'custom';
  gameKey: string;
  entryFeeWalletCents: number;
  listedPrizeUsdCents: number;
}): string {
  const route =
    snapshot.mode === 'ranked'
      ? '/(app)/(tabs)/play/ranked'
      : '/(app)/(tabs)/play/casual';
  if (snapshot.gameKey === H2H_QUICK_MATCH_GAME_KEY) {
    return `${route}?quick=1`;
  }
  const ec = Math.max(0, Math.trunc(snapshot.entryFeeWalletCents || 0));
  const pc = Math.max(0, Math.trunc(snapshot.listedPrizeUsdCents || 0));
  const g = encodeURIComponent(snapshot.gameKey || '');
  return `${route}?entryCents=${ec}&prizeCents=${pc}&game=${g}&intent=start`;
}

/** Global quick return to active queue when search keeps running in background. */
export function QueueReturnBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const phase = useMatchmakingStore((s) => s.phase);
  const activeMatch = useMatchmakingStore((s) => s.activeMatch);
  const queuePollSnapshot = useMatchmakingStore((s) => s.queuePollSnapshot);
  const keepSearchingWhenAway = useMatchmakingStore((s) => s.keepSearchingWhenAway);
  const queueMode = useMatchmakingStore((s) => s.queue);

  const inResultScreen = pathname.includes('/play/result/');
  const inMatchScreen = pathname.includes('/play/match/');
  const inQueueScreen = pathname.includes('/play/casual') || pathname.includes('/play/ranked');

  const status = useMemo(() => {
    if (inResultScreen) {
      return {
        key: 'finished',
        title: 'Match finished',
        sub: 'Result is ready',
        details: 'Your match completed. Open your result screen to review score and payout.',
        cta: 'Open result',
        onPress: () => router.push(pathname as never),
      };
    }
    if ((phase === 'in_match' || phase === 'lobby') && activeMatch?.matchId) {
      return {
        key: phase === 'lobby' ? 'lobby' : 'in_match',
        title: phase === 'lobby' ? 'Match lobby' : 'In live match',
        sub: `vs ${activeMatch.opponent.username}`,
        details:
          phase === 'lobby'
            ? 'Both players are connecting. Open the match lobby to start or wait for ready.'
            : 'Your match is active. Re-open it anytime from here.',
        cta: phase === 'lobby' ? 'Open lobby' : 'Open match',
        onPress: () => router.push(`/(app)/(tabs)/play/match/${activeMatch.matchId}` as never),
      };
    }
    if ((phase === 'searching' || phase === 'found') && queuePollSnapshot) {
      const href = buildQueueHref(queuePollSnapshot);
      const modeLabel = queueMode === 'ranked' ? 'ranked' : queueMode === 'custom' ? 'custom' : 'casual';
      return {
        key: phase,
        title: phase === 'found' ? 'Opponent found' : 'Searching for match',
        sub: phase === 'found' ? 'Accept match to continue' : `${modeLabel} queue is live`,
        details:
          phase === 'found'
            ? 'A match is ready. Open queue now to accept and lock your game.'
            : keepSearchingWhenAway
              ? 'You are still in queue in the background. Open queue to manage or cancel.'
              : 'Queue is active. Open it to manage, cancel, or accept when matched.',
        cta: 'Open queue',
        onPress: () => router.push(href as never),
      };
    }
    return null;
  }, [inResultScreen, phase, activeMatch, queuePollSnapshot, queueMode, keepSearchingWhenAway, router, pathname]);

  if (!status) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: Math.max(8, insets.top + 6) }]}>
      <View style={styles.card}>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
          accessibilityRole="button"
          accessibilityLabel="Open match status details"
        >
          <View style={styles.head}>
            <View style={styles.dot} />
            <View style={styles.headText}>
              <Text style={styles.title}>{status.title}</Text>
              <Text style={styles.sub}>{status.sub}</Text>
            </View>
            <SafeIonicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#F9A8D4" />
          </View>
        </Pressable>
        {expanded ? (
          <View style={styles.dropdown}>
            <Text style={styles.details}>{status.details}</Text>
            <Pressable
              onPress={status.onPress}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pillPressed]}
              accessibilityRole="button"
              accessibilityLabel={status.cta}
            >
              <Text style={styles.actionText}>{status.cta}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2100,
    alignItems: 'center',
  },
  card: {
    minWidth: 180,
    maxWidth: 320,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.5)',
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    overflow: 'hidden',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pillPressed: { opacity: 0.86 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#f472b6',
    marginTop: 1,
  },
  headText: { flex: 1 },
  title: {
    color: '#F9A8D4',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  sub: {
    marginTop: 1,
    color: 'rgba(226,232,240,0.95)',
    fontSize: 10,
    fontWeight: '700',
  },
  dropdown: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(236, 72, 153, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  details: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  actionBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.7)',
    backgroundColor: 'rgba(59,7,100,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionText: {
    color: '#FBCFE8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
