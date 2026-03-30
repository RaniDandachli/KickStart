import { useLocalSearchParams } from 'expo-router';

import TileClashGame from '@/minigames/tileclash/TileClashGame';

export default function TileClashRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const playMode = mode === 'prize' ? 'prize' : 'practice';
  return <TileClashGame playMode={playMode} />;
}
