import NeonGridScreen from '@/minigames/neongrid/NeonGridScreen';
import type { MatchFinishPayload } from '@/types/match';

export function H2hNeonGridMatch({
  matchSessionId,
  localPlayerId,
  opponentId,
  opponentDisplayName,
  onComplete,
}: {
  matchSessionId: string;
  localPlayerId: string;
  opponentId: string;
  opponentDisplayName: string;
  onComplete: (p: MatchFinishPayload) => void;
}) {
  return (
    <NeonGridScreen
      h2hSkillContest={{
        matchSessionId,
        localPlayerId,
        opponentId,
        opponentDisplayName,
        onComplete,
      }}
    />
  );
}
