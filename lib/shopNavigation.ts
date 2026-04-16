import type { Router } from 'expo-router';
import { Alert } from 'react-native';

import { pushCrossTab } from '@/lib/appNavigation';

export const SHOP_PATH = '/(app)/(tabs)/profile/add-funds' as const;
export const SHOP_WALLET_HREF = `${SHOP_PATH}?tab=wallet` as const;
export const SHOP_CREDITS_HREF = `${SHOP_PATH}?tab=credits` as const;

/** Same as `SHOP_CREDITS_HREF` — kept for older imports. */
export const ARCADE_CREDITS_SHOP_HREF = SHOP_CREDITS_HREF;

/** Contest / cash wallet top-up (H2H entry, contests). */
export function pushCashWalletShop(router: Router): void {
  pushCrossTab(router, SHOP_WALLET_HREF as never);
}

/** Arcade credit packs (minigame prize runs). */
export function pushArcadeCreditsShop(router: Router): void {
  pushCrossTab(router, SHOP_CREDITS_HREF as never);
}

/**
 * Lets the user pick cash wallet vs arcade credits before opening Shop.
 * Use on Home / generic “Add money”; use {@link pushCashWalletShop} when the UI is already contest-specific (e.g. wallet pill).
 */
export function presentAddMoneyChooser(router: Router): void {
  Alert.alert(
    'Add money',
    'Cash adds to your wallet for contests and skill matches. Arcade credits are for minigame prize runs and the ticket economy.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy arcade credits', onPress: () => pushArcadeCreditsShop(router) },
      { text: 'Add cash for contests', onPress: () => pushCashWalletShop(router) },
    ],
  );
}
