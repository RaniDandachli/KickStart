import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { ArcadePlayModeModal } from '@/components/arcade/ArcadePlayModeModal';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { alertInsufficientPrizeCredits, pushArcadeCreditsShop } from '@/lib/arcadeCreditsShop';
import {
  consumePrizeRunEntryCredits,
  PRIZE_RUN_ENTRY_CREDITS,
  STACKER_PRIZE_RUN_ENTRY_CREDITS,
  TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS,
} from '@/lib/arcadeEconomy';
import { ARCADE_HUB_RETURN_PATH, withReturnHref } from '@/lib/minigameReturnHref';
import { useAuthStore } from '@/store/authStore';

export type ArcadePlayLauncherRoute =
  | 'tap-dash'
  | 'tile-clash'
  | 'dash-duel'
  | 'ball-run'
  | 'turbo-arena'
  | 'neon-pool'
  | 'stacker'
  | 'neon-dance'
  | 'neon-grid'
  | 'neon-ship'
  | 'cyber-road';

const BASE = '/(app)/(tabs)/play/minigames';

type Props = {
  gameRoute: ArcadePlayLauncherRoute;
  title: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

function prizeCreditsForRoute(route: ArcadePlayLauncherRoute): number | undefined {
  if (route === 'turbo-arena') return TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS;
  if (route === 'stacker') return STACKER_PRIZE_RUN_ENTRY_CREDITS;
  return undefined;
}

export function ArcadePlayLauncher({ gameRoute, title, children, style }: Props) {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const [open, setOpen] = useState(false);
  const path = `${BASE}/${gameRoute}`;
  const prizeEntryCredits = prizeCreditsForRoute(gameRoute);
  const prizeCost = prizeEntryCredits ?? PRIZE_RUN_ENTRY_CREDITS;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Play ${title}`}
        style={({ pressed }) => [style, pressed && { opacity: 0.92 }]}
      >
        {children}
      </Pressable>
      <ArcadePlayModeModal
        visible={open}
        gameTitle={title}
        prizeEntryCredits={prizeEntryCredits}
        onClose={() => setOpen(false)}
        onBuyCredits={() => {
          setOpen(false);
          pushArcadeCreditsShop(router);
        }}
        onPractice={() => {
          setOpen(false);
          router.push(withReturnHref(`${path}?mode=practice`, ARCADE_HUB_RETURN_PATH) as never);
        }}
        onPrizeRun={() => {
          if (ENABLE_BACKEND && uid && !consumePrizeRunEntryCredits(profileQ.data?.prize_credits, prizeCost)) {
            alertInsufficientPrizeCredits(
              router,
              `Prize runs cost ${prizeCost} prize credits. Practice is free.`,
            );
            return;
          }
          setOpen(false);
          router.push(withReturnHref(`${path}?mode=prize`, ARCADE_HUB_RETURN_PATH) as never);
        }}
      />
    </>
  );
}
