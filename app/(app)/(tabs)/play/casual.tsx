import { useLocalSearchParams } from 'expo-router';

import { QueueScreen } from '@/features/play/QueueScreen';

function parseUsd(v: string | string[] | undefined): number | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function CasualQueueScreen() {
  const params = useLocalSearchParams();
  const entry = parseUsd(params.entry);
  const win = parseUsd(params.win);
  const hasPair = entry != null && win != null;

  return (
    <QueueScreen
      mode="casual"
      stakeEntryUsd={hasPair ? entry : undefined}
      stakeWinUsd={hasPair ? win : undefined}
    />
  );
}
