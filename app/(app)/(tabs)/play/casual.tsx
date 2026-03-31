import { useLocalSearchParams } from 'expo-router';

import { PickGameForQueue } from '@/features/play/PickGameForQueue';
import { QueueScreen } from '@/features/play/QueueScreen';
import { H2H_OPEN_GAMES, titleForH2hGameKey } from '@/lib/homeOpenMatches';

function parseUsd(v: string | string[] | undefined): number | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const VALID_GAME_KEYS = new Set(H2H_OPEN_GAMES.map((g) => g.gameKey));

function parseGameKey(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  return VALID_GAME_KEYS.has(s) ? s : undefined;
}

function parseIntent(v: string | string[] | undefined): 'join' | 'start' | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  if (s === 'join' || s === 'start') return s;
  return undefined;
}

export default function CasualQueueScreen() {
  const params = useLocalSearchParams();
  const entry = parseUsd(params.entry);
  const prize = parseUsd(params.prize) ?? parseUsd(params.win);
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
      gameTitle={gameKey ? titleForH2hGameKey(gameKey) : undefined}
      gameKey={gameKey}
      queueIntent={queueIntent}
    />
  );
}
