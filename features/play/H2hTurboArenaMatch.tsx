import TurboArenaGame from '@/minigames/turboarenagame/TurboArenagame';
import type { MatchFinishPayload } from '@/types/match';

export function H2hTurboArenaMatch({
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
    <TurboArenaGame
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
