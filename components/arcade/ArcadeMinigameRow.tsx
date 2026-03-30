import { type ReactNode, useState } from 'react';
import { useRouter } from 'expo-router';

import { ArcadeGameRow, type RunitBorderAccent } from '@/components/arcade/ArcadeGameRow';
import { ArcadePlayModeModal } from '@/components/arcade/ArcadePlayModeModal';

type Props = {
  gameRoute: 'tap-dash' | 'tile-clash' | 'dash-duel' | 'ball-run' | 'turbo-arena';
  title: string;
  entryLabel: string;
  winLabel: string;
  bgColors: readonly [string, string, ...string[]];
  borderAccent: RunitBorderAccent;
  iconSlot: ReactNode;
  titleColor?: string;
  entryColor?: string;
};

const BASE = '/(app)/(tabs)/play/minigames';

export function ArcadeMinigameRow(props: Props) {
  const router = useRouter();
  const { gameRoute, title, ...rowProps } = props;
  const [open, setOpen] = useState(false);
  const path = `${BASE}/${gameRoute}`;

  return (
    <>
      <ArcadeGameRow {...rowProps} title={title} onPress={() => setOpen(true)} />
      <ArcadePlayModeModal
        visible={open}
        gameTitle={title}
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
