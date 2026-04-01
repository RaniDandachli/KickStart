import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import type { MatchFinishPayload, KickClashMatchSession } from '@/types/match';

export interface GameplayPlaceholderProps {
  session: KickClashMatchSession;
  onFinish: (result: MatchFinishPayload) => void;
  onPauseToggle?: (paused: boolean) => void;
  /**
   * When set, the timer result is overridden so the local player always wins or loses
   * (used for promotional daily bracket flow — keep UI honest with snap scores).
   */
  forcedOutcome?: 'win' | 'lose';
  /** Hide opponent “+Goal” so the outcome is only from the script + your taps. */
  hideOpponentControls?: boolean;
}

/**
 * Stand-in until a real synced minigame exists: timer + score goals determine winner.
 * Ties count as a draw (no prize).
 */
export function GameplayPlaceholder({
  session,
  onFinish,
  onPauseToggle,
  forcedOutcome,
  hideOpponentControls,
}: GameplayPlaceholderProps) {
  const [scoreSelf, setScoreSelf] = useState(session.scoreSelf);
  const [scoreOpponent, setScoreOpponent] = useState(session.scoreOpponent);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(session.durationSec);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const finished = useRef(false);

  const oppLabel = session.opponentDisplayName ?? 'Opponent';

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

  /** Snap scoreboard near buzzer so the strip matches the scripted winner */
  useEffect(() => {
    if (!forcedOutcome || remaining > 4) return;
    if (forcedOutcome === 'win') {
      setScoreSelf(12);
      setScoreOpponent(4);
    } else {
      setScoreSelf(4);
      setScoreOpponent(12);
    }
  }, [remaining, forcedOutcome]);

  useEffect(() => {
    if (remaining !== 0 || finished.current) return;
    finished.current = true;
    let winnerId: string;
    if (forcedOutcome === 'win') {
      winnerId = session.localPlayerId;
    } else if (forcedOutcome === 'lose') {
      winnerId = session.opponentId;
    } else if (scoreSelf === scoreOpponent) {
      winnerId = 'draw';
    } else if (scoreSelf > scoreOpponent) {
      winnerId = session.localPlayerId;
    } else {
      winnerId = session.opponentId;
    }
    const fs =
      forcedOutcome === 'win'
        ? { self: 12, opponent: 4 }
        : forcedOutcome === 'lose'
          ? { self: 4, opponent: 12 }
          : { self: scoreSelf, opponent: scoreOpponent };
    onFinish({
      winnerId,
      finalScore: fs,
      reason: 'time',
    });
  }, [
    remaining,
    onFinish,
    scoreSelf,
    scoreOpponent,
    session.localPlayerId,
    session.opponentId,
    forcedOutcome,
  ]);

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
        <Text className="mb-1 text-xs uppercase text-slate-500">Skill contest (stub)</Text>
        <Text className="text-xl font-black text-fuchsia-500">
          Tap +Goal to simulate points — highest score when time hits 0 wins.
        </Text>
        <Text className="mt-1 text-sm text-slate-600">Replace with your real minigame + server verification.</Text>
      </Card>
      <Card className="items-center">
        <Text className="text-5xl font-black text-slate-900">{remaining}s</Text>
        <Text className="text-slate-500">Match · {session.id}</Text>
      </Card>
      <View className="flex-row justify-between gap-3">
        <Card className="flex-1 items-center">
          <Text className="text-xs text-slate-500">You</Text>
          <Text className="text-4xl font-bold text-sky-600">{scoreSelf}</Text>
          <AppButton title="+Goal" variant="secondary" onPress={() => setScoreSelf((s) => s + 1)} />
        </Card>
        <Card className="flex-1 items-center">
          <Text className="text-xs text-slate-500" numberOfLines={1}>
            {oppLabel}
          </Text>
          <Text className="text-4xl font-bold text-fuchsia-600">{scoreOpponent}</Text>
          {!hideOpponentControls ? (
            <AppButton title="+Goal" variant="secondary" onPress={() => setScoreOpponent((s) => s + 1)} />
          ) : (
            <Text className="mt-2 text-[10px] text-slate-500">CPU</Text>
          )}
        </Card>
      </View>
      <AppButton title={paused ? 'Resume' : 'Pause'} variant="ghost" onPress={togglePause} />
    </View>
  );
}
