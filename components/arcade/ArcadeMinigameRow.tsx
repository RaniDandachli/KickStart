import { type ReactNode, useState } from 'react';
import { useRouter } from 'expo-router';

import { ArcadeGameRow, type RunitBorderAccent } from '@/components/arcade/ArcadeGameRow';
import { ArcadePlayModeModal } from '@/components/arcade/ArcadePlayModeModal';
import { STACKER_PRIZE_RUN_ENTRY_CREDITS, TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';

type Props = {
  gameRoute:
    | 'tap-dash'
    | 'tile-clash'
    | 'dash-duel'
    | 'ball-run'
    | 'turbo-arena'
    | 'neon-pool'
    | 'stacker';
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
  const { gameRoute, title, emphasized, compact, ...rowProps } = props;
  const [open, setOpen] = useState(false);
  const path = `${BASE}/${gameRoute}`;
  const prizeEntryCredits =
    gameRoute === 'turbo-arena'
      ? TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS
      : gameRoute === 'stacker'
        ? STACKER_PRIZE_RUN_ENTRY_CREDITS
        : undefined;

  return (
    <>
      <ArcadeGameRow {...rowProps} title={title} emphasized={emphasized} compact={compact} onPress={() => setOpen(true)} />
      <ArcadePlayModeModal
        visible={open}
        gameTitle={title}
        prizeEntryCredits={prizeEntryCredits}
        onClose={() => setOpen(false)}
        onPractice={() => {
          setOpen(false);
          router.push(`${path}?mode=practice` as never);
        }}
        onPrizeRun={() => {
          setOpen(false);
          router.push(`${path}?mode=prize` as never);
        }}
      />
    </>
  );
}
