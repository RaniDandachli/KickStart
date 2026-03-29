import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import type { MatchFinishPayload, KickClashMatchSession } from '@/types/match';

export interface GameplayPlaceholderProps {
  session: KickClashMatchSession;
  onFinish: (result: MatchFinishPayload) => void;
  onPauseToggle?: (paused: boolean) => void;
}

/**
 * TODO: Replace with real physics engine + networked state. Hooks preserved for engine integration.
 */
export function GameplayPlaceholder({ session, onFinish, onPauseToggle }: GameplayPlaceholderProps) {
  const [scoreSelf, setScoreSelf] = useState(session.scoreSelf);
  const [scoreOpponent, setScoreOpponent] = useState(session.scoreOpponent);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(session.durationSec);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (tick.current) clearInterval(tick.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [paused]);

  useEffect(() => {
    if (remaining === 0) {
      const winnerId =
        scoreSelf === scoreOpponent
          ? session.localPlayerId
          : scoreSelf > scoreOpponent
            ? session.localPlayerId
            : session.opponentId;
      onFinish({
        winnerId,
        finalScore: { self: scoreSelf, opponent: scoreOpponent },
        reason: 'time',
      });
    }
  }, [remaining, onFinish, scoreSelf, scoreOpponent, session.localPlayerId, session.opponentId]);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      onPauseToggle?.(next);
      return next;
    });
  }, [onPauseToggle]);

  return (
    <View className="gap-3">
      <Card>
        <Text className="mb-1 text-xs uppercase text-slate-500">Prototype arena</Text>
        <Text className="text-2xl font-black text-fuchsia-600">Arcade engine stub</Text>
        <Text className="mt-1 text-sm text-slate-600">
          Timer + score only. TODO: inputs, ball physics, networking reconciliation.
        </Text>
      </Card>
      <Card className="items-center">
        <Text className="text-5xl font-black text-slate-900">{remaining}s</Text>
        <Text className="text-slate-500">Match id · {session.id}</Text>
      </Card>
      <View className="flex-row justify-between gap-3">
        <Card className="flex-1 items-center">
          <Text className="text-xs text-slate-500">You</Text>
          <Text className="text-4xl font-bold text-sky-600">{scoreSelf}</Text>
          <AppButton title="+Goal" variant="secondary" onPress={() => setScoreSelf((s) => s + 1)} />
        </Card>
        <Card className="flex-1 items-center">
          <Text className="text-xs text-slate-500">Opp</Text>
          <Text className="text-4xl font-bold text-fuchsia-600">{scoreOpponent}</Text>
          <AppButton title="+Goal" variant="secondary" onPress={() => setScoreOpponent((s) => s + 1)} />
        </Card>
      </View>
      <AppButton title={paused ? 'Resume' : 'Pause'} variant="ghost" onPress={togglePause} />
    </View>
  );
}
