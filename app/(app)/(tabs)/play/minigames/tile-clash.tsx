import { useLocalSearchParams } from 'expo-router';

import TileClashGame from '@/minigames/tileclash/TileClashGame';

export default function TileClashRoute() {
  const { mode, weeklyRace } = useLocalSearchParams<{ mode?: string; weeklyRace?: string }>();
  const wr = weeklyRace === '1' || weeklyRace === 'true';
  const playMode = wr ? 'practice' : mode === 'prize' ? 'prize' : 'practice';
  return <TileClashGame playMode={playMode} weeklyRace={wr} />;
}
