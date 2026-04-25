import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';

import { ArcadeGameRow, type RunitBorderAccent } from '@/components/arcade/ArcadeGameRow';
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
import { useAuthStore } from '@/store/authStore';

type Props = {
  gameRoute:
    | 'tap-dash'
    | 'tile-clash'
    | 'dash-duel'
    | 'ball-run'
    | 'turbo-arena'
    | 'neon-pool'
    | 'stacker'
    | 'neon-dance'
    | 'neon-grid'
    | 'neon-ship';
  title: string;
  entryLabel: string;
  winLabel: string;
  bgColors: readonly [string, string, ...string[]];
  borderAccent: RunitBorderAccent;
  iconSlot: ReactNode;
  titleColor?: string;
  entryColor?: string;
  /** Bigger card + glow on Arcade “Hot games” */
  emphasized?: boolean;
  compact?: boolean;
};

const BASE = '/(app)/(tabs)/play/minigames';

export function ArcadeMinigameRow(props: Props) {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const { gameRoute, title, emphasized, compact, ...rowProps } = props;
  const [open, setOpen] = useState(false);
  const path = `${BASE}/${gameRoute}`;
  const prizeEntryCredits =
    gameRoute === 'turbo-arena'
      ? TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS
      : gameRoute === 'stacker'
        ? STACKER_PRIZE_RUN_ENTRY_CREDITS
        : undefined;
  const prizeCost = prizeEntryCredits ?? PRIZE_RUN_ENTRY_CREDITS;

  return (
    <>
      <ArcadeGameRow {...rowProps} title={title} emphasized={emphasized} compact={compact} onPress={() => setOpen(true)} />
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
          router.push(`${path}?mode=practice` as never);
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
          router.push(`${path}?mode=prize` as never);
        }}
      />
    </>
  );
}
