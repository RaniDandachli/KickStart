import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useHomeH2hQueueBoard } from '@/hooks/useHomeH2hQueueBoard';
import { useProfile } from '@/hooks/useProfile';
import { openSlotWatchMatchesWaiterRow } from '@/lib/h2hOpenSlotWatchMatch';
import { titleForH2hGameKey } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { appBorderAccent, runit, runitFont } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { sortWaitersForDisplay, type H2hBoardWaiter } from '@/store/homeH2hBoardStore';

function pickMatchingWaiter(
  waiters: H2hBoardWaiter[],
  profile: { push_notify_h2h_open_slots?: boolean | null; h2h_open_slot_watch?: unknown } | null | undefined,
): H2hBoardWaiter | null {
  if (!profile || profile.push_notify_h2h_open_slots !== true) return null;
  const watch = profile.h2h_open_slot_watch;
  const sorted = sortWaitersForDisplay(waiters);
  for (const w of sorted) {
    if (w.isSelf) continue;
    if (
      !openSlotWatchMatchesWaiterRow(
        { game_key: w.gameKey, entry_fee_wallet_cents: w.entryFeeWalletCents ?? 0 },
        watch,
      )
    ) {
      continue;
    }
    return w;
  }
  return null;
}

/**
 * In-app heads-up when the live queue has a row that matches the user’s open-slot alert prefs
 * (same filter as `h2hOpenMatchWatchScan`). Slides in from the top; tap → Live matches.
 */
export function OpenSlotInAppBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const uid = userId && userId !== 'guest' ? userId : undefined;
  const profileQ = useProfile(ENABLE_BACKEND ? uid : undefined);
  const boardQ = useHomeH2hQueueBoard();

  const [dismissedById, setDismissedById] = useState<Record<string, true>>({});
  const [appActive, setAppActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setAppActive(next === 'active');
    });
    return () => sub.remove();
  }, []);

  const pick = useMemo(
    () => pickMatchingWaiter(boardQ.data ?? [], profileQ.data),
    [boardQ.data, profileQ.data],
  );

  const shouldShow = Boolean(pick && !dismissedById[pick.id] && appActive);

  const translateY = useRef(new Animated.Value(-160)).current;
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: shouldShow ? 0 : -160,
      useNativeDriver: true,
      friction: 9,
      tension: 78,
    }).start();
  }, [shouldShow, translateY]);

  if (!ENABLE_BACKEND || !uid) return null;

  const gameTitle = pick ? titleForH2hGameKey(pick.gameKey) : '';
  const fee =
    pick && typeof pick.entryFeeWalletCents === 'number'
      ? formatUsdFromCents(pick.entryFeeWalletCents)
      : '—';

  return (
    <View style={styles.anchor} pointerEvents={shouldShow ? 'box-none' : 'none'}>
      <Animated.View style={[styles.sheet, { top: insets.top + 6, transform: [{ translateY }] }]} pointerEvents="box-none">
        {pick && shouldShow ? (
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/play/live-matches')}
            accessibilityRole="button"
            accessibilityLabel={`Open live matches: ${gameTitle} at ${fee}`}
            style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
          >
            <LinearGradient
              colors={['rgba(123, 92, 255, 0.95)', 'rgba(26, 16, 52, 0.96)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            >
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <SafeIonicons name="notifications" size={22} color={runit.neonCyan} />
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.title}>There’s a match that works for you</Text>
                  <Text style={styles.subtitle}>
                    {gameTitle} · {fee} — tap to jump in before the queue moves on.
                  </Text>
                </View>
                <Pressable
                  hitSlop={12}
                  onPress={() => setDismissedById((d) => ({ ...d, [pick.id]: true }))}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss open match alert"
                  style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                >
                  <SafeIonicons name="close" size={22} color="rgba(255,255,255,0.85)" />
                </Pressable>
              </View>
            </LinearGradient>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200_000,
    elevation: 200_000,
    pointerEvents: 'box-none',
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    pointerEvents: 'box-none',
  },
  pressable: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: appBorderAccent,
    ...Platform.select({
      web: { boxShadow: '0 12px 40px rgba(0,0,0,0.45)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 14,
      },
    }),
  },
  pressablePressed: {
    opacity: 0.92,
  },
  gradient: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: runitFont.bold,
    color: '#fff',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: runitFont.regular,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});
