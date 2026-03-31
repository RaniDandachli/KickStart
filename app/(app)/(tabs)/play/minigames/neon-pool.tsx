import { useLocalSearchParams } from 'expo-router';

import NeonPoolGame from '@/minigames/neonpool/NeonPoolGame';

export default function NeonPoolRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const playMode = mode === 'prize' ? 'prize' : 'practice';
  return <NeonPoolGame playMode={playMode} />;
}
