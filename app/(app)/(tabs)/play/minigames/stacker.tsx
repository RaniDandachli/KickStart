import { useLocalSearchParams } from 'expo-router';

import StackerGame from '@/minigames/stacker/StackerGame';

export default function StackerRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const playMode = mode === 'prize' ? 'prize' : 'practice';
  return <StackerGame playMode={playMode} />;
}
