import { useLocalSearchParams } from 'expo-router';

import BallRunGame from '@/minigames/ballrun/BallRunGame';

export default function BallRunRoute() {
  const { mode, seed } = useLocalSearchParams<{ mode?: string; seed?: string }>();
  const playMode = mode === 'prize' ? 'prize' : 'practice';
  const parsed = seed != null ? parseInt(String(seed), 10) : NaN;
  const runSeed = Number.isFinite(parsed) ? parsed >>> 0 : undefined;
  return <BallRunGame playMode={playMode} runSeed={runSeed} />;
}
