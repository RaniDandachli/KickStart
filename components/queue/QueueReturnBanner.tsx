import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const phase = useMatchmakingStore((s) => s.phase);
  const queuePollSnapshot = useMatchmakingStore((s) => s.queuePollSnapshot);
  const keepSearchingWhenAway = useMatchmakingStore((s) => s.keepSearchingWhenAway);

  const alreadyInQueueScreen =
    pathname.includes('/play/casual') || pathname.includes('/play/ranked');
  const visible = phase === 'searching' && !!queuePollSnapshot && !alreadyInQueueScreen;
  if (!visible || !queuePollSnapshot) return null;

  const href = buildQueueHref(queuePollSnapshot);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: Math.max(8, insets.top + 6) }]}>
      <Pressable
        onPress={() => router.push(href as never)}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        accessibilityRole="button"
        accessibilityLabel="In queue. Open matchmaking screen."
      >
        <Text style={styles.title}>In queue</Text>
        <Text style={styles.sub}>{keepSearchingWhenAway ? 'Tap to manage or cancel' : 'Tap to return'}</Text>
      </Pressable>
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
  pill: {
    minWidth: 140,
    maxWidth: 280,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.5)',
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    alignItems: 'center',
  },
  pillPressed: { opacity: 0.86 },
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
});
