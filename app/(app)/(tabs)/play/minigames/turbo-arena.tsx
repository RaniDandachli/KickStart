import { Redirect, useLocalSearchParams } from 'expo-router';

import { SHOW_TURBO_ARENA_MINIGAME } from '@/constants/featureFlags';
import TurboArenaScreen from '@/minigames/turboarenagame/TurboArenaScreen';

export default function TurboArenaRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  if (!SHOW_TURBO_ARENA_MINIGAME) {
    return <Redirect href="/(app)/(tabs)/play" />;
  }
  const playMode = mode === 'prize' ? 'prize' : 'practice';
  return <TurboArenaScreen playMode={playMode} />;
}
