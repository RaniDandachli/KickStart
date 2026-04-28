import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setHasCompletedTabTour } from '@/lib/onboardingStorage';
import { runit, runitFont } from '@/lib/runitArcadeTheme';
import { getDefaultTabBarStyle } from '@/lib/tabBarStyle';

const { width: SCREEN_W } = Dimensions.get('window');

/** Matches native tab order (see `(tabs)/_layout`). Prizes are opened from Arcade on mobile — no Prizes tab. */
const TAB_TOUR_STEPS: { href: string; title: string; body: string }[] = [
  { href: '/(app)/(tabs)', title: 'Home', body: 'Choose Quick Match, Live matches, or your contest — plus daily events and stats.' },
  {
    href: '/(app)/(tabs)/tournaments',
    title: 'Events',
    body: 'Tournaments, brackets, Weekly Race, Daily Race challenges — all competition lives here.',
  },
  {
    href: '/(app)/(tabs)/play',
    title: 'Arcade',
    body: 'Minigames and prize runs · open Prize catalog from the Arcade screen (gift row).',
  },
  { href: '/(app)/(tabs)/profile', title: 'You', body: 'Wallet, profile, and account.' },
];

type Props = { onFinished?: () => void };

export function FirstRunTabTour({ onFinished }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  const tabBarStyle = getDefaultTabBarStyle(insets.bottom);
  const tabBarPadBottom = typeof tabBarStyle.paddingBottom === 'number' ? tabBarStyle.paddingBottom : 16;
  const tabBarPadTop = typeof tabBarStyle.paddingTop === 'number' ? tabBarStyle.paddingTop : 8;
  /** Icon + label row — matches expo default tab bar ~49–54px content. */
  const tabContentH = 52;
  const tabBarHeight = tabBarPadTop + tabContentH + tabBarPadBottom;
  const arrowBottom = tabBarHeight + 6;
  const cardBottomMargin = arrowBottom + 40;

  const idx = Math.min(step, TAB_TOUR_STEPS.length - 1);
  const tabCenterX = (SCREEN_W / TAB_TOUR_STEPS.length) * (idx + 0.5);

  useEffect(() => {
    const s = TAB_TOUR_STEPS[idx];
    if (!s) return;
    router.navigate(s.href as Href);
  }, [idx, router]);

  const finish = useCallback(async () => {
    await setHasCompletedTabTour();
    setVisible(false);
    onFinished?.();
  }, [onFinished]);

  const onNext = useCallback(() => {
    if (step >= TAB_TOUR_STEPS.length - 1) {
      void finish();
      return;
    }
    setStep((x) => x + 1);
  }, [step, finish]);

  if (!visible) return null;

  const current = TAB_TOUR_STEPS[idx]!;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.dim} />

        <View style={[styles.arrowWrap, { bottom: arrowBottom, left: tabCenterX - 14 }]} pointerEvents="none">
          <SafeIonicons name="arrow-down" size={28} color={runit.neonCyan} />
        </View>

        <View style={[styles.card, { marginBottom: cardBottomMargin }]} pointerEvents="box-none">
          <Text style={[styles.stepLbl, { fontFamily: runitFont.bold }]}>TAB {idx + 1} / {TAB_TOUR_STEPS.length}</Text>
          <Text style={[styles.title, { fontFamily: runitFont.black }]}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
          <View style={styles.row}>
            {step > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.85 }]}
                onPress={() => setStep((s) => Math.max(0, s - 1))}
              >
                <Text style={styles.ghostText}>Back</Text>
              </Pressable>
            ) : (
              <View style={styles.ghost} />
            )}
            <Pressable style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]} onPress={onNext}>
              <Text style={[styles.primaryText, { fontFamily: runitFont.bold }]}>
                {step >= TAB_TOUR_STEPS.length - 1 ? 'GOT IT' : 'NEXT'}
              </Text>
              <SafeIonicons name="chevron-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 2, 12, 0.72)',
  },
  arrowWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  card: {
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(0, 240, 255, 0.35)',
    backgroundColor: 'rgba(12, 6, 22, 0.94)',
    zIndex: 3,
  },
  stepLbl: {
    color: 'rgba(0, 240, 255, 0.85)',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  body: {
    color: 'rgba(226, 232, 240, 0.92)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ghost: {
    minWidth: 72,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  ghostText: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 15,
    fontWeight: '700',
  },
  primary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: runit.neonPink,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  primaryText: {
    color: '#fff',
    fontSize: 15,
    letterSpacing: 1,
  },
});
