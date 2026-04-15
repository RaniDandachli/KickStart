import { useLocalSearchParams } from 'expo-router';

import NeonDanceGame from '@/minigames/neondance/NeonDanceGame';

export default function NeonDanceRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const playMode = mode === 'prize' ? 'prize' : 'practice';
  return <NeonDanceGame playMode={playMode} />;
}
