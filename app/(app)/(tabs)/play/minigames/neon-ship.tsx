import { SHOW_NEON_SHIP_MINIGAME } from '@/constants/featureFlags';
import NeonShipScreen from '@/minigames/neonship/NeonShipScreen';
import { Redirect } from 'expo-router';

export default function NeonShipRoute() {
  if (!SHOW_NEON_SHIP_MINIGAME) {
    return <Redirect href="/(app)/(tabs)/play" />;
  }
  return <NeonShipScreen />;
}
