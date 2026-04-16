import type { Router } from 'expo-router';
import { Alert } from 'react-native';

import { pushArcadeCreditsShop } from '@/lib/shopNavigation';

export { ARCADE_CREDITS_SHOP_HREF, pushArcadeCreditsShop } from '@/lib/shopNavigation';

/**
 * Shown when a prize run can’t start for lack of `prize_credits`. Offers navigation to the credit pack shop.
 */
export function alertInsufficientPrizeCredits(router: Router, body: string): void {
  Alert.alert('Not enough prize credits', body, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Buy credits', onPress: () => pushArcadeCreditsShop(router) },
  ]);
}
