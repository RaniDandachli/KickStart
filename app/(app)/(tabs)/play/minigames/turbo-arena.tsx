import { useLocalSearchParams } from 'expo-router';

import TurboArenaScreen from '@/minigames/turboarenagame/TurboArenaScreen';

export default function TurboArenaRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const playMode = mode === 'prize' ? 'prize' : 'practice';
  return <TurboArenaScreen playMode={playMode} />;
}
