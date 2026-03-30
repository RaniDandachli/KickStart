import { useLocalSearchParams } from 'expo-router';

import TapDashGame from '@/minigames/tapdash/TapDashGame';

export default function TapDashRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const playMode = mode === 'prize' ? 'prize' : 'practice';
  return <TapDashGame playMode={playMode} />;
}
