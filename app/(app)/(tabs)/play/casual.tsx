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
  const prize = parseUsd(params.prize) ?? parseUsd(params.win);
  const hasPair = entry != null && prize != null;

  return (
    <QueueScreen
      mode="casual"
      entryFeeUsd={hasPair ? entry : undefined}
      listedPrizeUsd={hasPair ? prize : undefined}
    />
  );
}
