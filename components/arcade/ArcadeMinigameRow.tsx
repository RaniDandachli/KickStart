import { type ReactNode } from 'react';

import { ArcadeGameRow, type RunitBorderAccent } from '@/components/arcade/ArcadeGameRow';
import { ArcadePlayLauncher, type ArcadePlayLauncherRoute } from '@/components/arcade/ArcadePlayLauncher';

type Props = {
  gameRoute: ArcadePlayLauncherRoute;
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

export function ArcadeMinigameRow(props: Props) {
  const { gameRoute, title, emphasized, compact, ...rowProps } = props;

  return (
    <ArcadePlayLauncher gameRoute={gameRoute} title={title}>
      <ArcadeGameRow
        {...rowProps}
        title={title}
        emphasized={emphasized}
        compact={compact}
        pressable={false}
        onPress={() => {}}
      />
    </ArcadePlayLauncher>
  );
}
