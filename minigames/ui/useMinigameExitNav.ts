import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import type { Href } from 'expo-router';

import { parseMinigameReturnHref, primaryExitLabel } from '@/lib/minigameReturnHref';
import { ROUTE_MINIGAMES } from '@/minigames/ui/GameOverExitRow';

/**
 * Respect `returnHref` (encodeURIComponent path) so exiting a minigame returns to Money / Events /
 * Arcade hub instead of always landing on Minigames.
 */
export function useMinigameExitNav(): {
  replaceToPrimaryExit: () => void;
  replacePrimaryLabel: string;
  replaceToMinigames: () => void;
  replaceToHomeTab: () => void;
  onHeaderBackPress: () => void;
} {
  const router = useRouter();
  const { returnHref } = useLocalSearchParams<{ returnHref?: string }>();
  const safeReturn = useMemo(() => parseMinigameReturnHref(returnHref), [returnHref]);
  const primaryTarget = useMemo<Href>(() => safeReturn ?? (ROUTE_MINIGAMES as unknown as Href), [safeReturn]);
  const primaryLabel = useMemo(() => primaryExitLabel(safeReturn), [safeReturn]);

  const replaceToPrimaryExit = useCallback(() => {
    router.replace(primaryTarget as never);
  }, [router, primaryTarget]);

  const replaceToMinigames = useCallback(() => {
    router.replace(ROUTE_MINIGAMES as never);
  }, [router]);

  const replaceToHomeTab = useCallback(() => {
    router.replace('/(app)/(tabs)' as never);
  }, [router]);

  const onHeaderBackPress = useCallback(() => {
    if (safeReturn) {
      router.replace(safeReturn as never);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(ROUTE_MINIGAMES as never);
  }, [router, safeReturn]);

  return {
    replaceToPrimaryExit,
    replacePrimaryLabel: primaryLabel,
    replaceToMinigames,
    replaceToHomeTab,
    onHeaderBackPress,
  };
}
