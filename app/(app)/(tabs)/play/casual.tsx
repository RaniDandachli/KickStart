import { useLocalSearchParams } from 'expo-router';

import { PickGameForQueue } from '@/features/play/PickGameForQueue';
import { QueueScreen } from '@/features/play/QueueScreen';
import { H2H_OPEN_GAMES, titleForH2hGameKey, type H2hGameKey } from '@/lib/homeOpenMatches';

function parseUsd(v: string | string[] | undefined): number | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseGameKey(v: string | string[] | undefined): H2hGameKey | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  if (!H2H_OPEN_GAMES.some((g) => g.gameKey === s)) return undefined;
  return s as H2hGameKey;
}

function parseIntent(v: string | string[] | undefined): 'join' | 'start' | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  if (s === 'join' || s === 'start') return s;
  return undefined;
}

/** Integer cents from URL — matches `h2h_queue_entries` / RPC exactly (no float drift). */
function parseCentsParam(v: string | string[] | undefined): number | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number.parseInt(String(s), 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default function CasualQueueScreen() {
  const params = useLocalSearchParams();
  const quickRaw = params.quick;
  const quickMatch = quickRaw === '1' || quickRaw === 'true';
  const entryCentsParam = parseCentsParam(params.entryCents);
  const prizeCentsParam = parseCentsParam(params.prizeCents);
  const hasExactCents = entryCentsParam != null && prizeCentsParam != null;
  const queueTierCents = hasExactCents ? { entry: entryCentsParam, prize: prizeCentsParam } : undefined;
  const entry = hasExactCents ? entryCentsParam / 100 : parseUsd(params.entry);
  const prize = hasExactCents ? prizeCentsParam / 100 : parseUsd(params.prize) ?? parseUsd(params.win);
  const hasPair = entry != null && prize != null;
  const gameKey = parseGameKey(params.game);
  const queueIntent = parseIntent(params.intent);

  /** Contest tier chosen (e.g. from Home) but no game yet — pick minigame first. */
  if (hasPair && entry != null && prize != null && !gameKey) {
    return <PickGameForQueue entryUsd={entry} prizeUsd={prize} />;
  }

  return (
    <QueueScreen
      mode="casual"
      entryFeeUsd={hasPair ? entry : undefined}
      listedPrizeUsd={hasPair ? prize : undefined}
      queueTierCents={queueTierCents}
      gameTitle={gameKey ? titleForH2hGameKey(gameKey) : undefined}
      gameKey={gameKey}
      queueIntent={queueIntent}
      quickMatch={quickMatch && !hasPair}
    />
  );
}
