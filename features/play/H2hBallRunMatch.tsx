import NeonBallRunGame from '@/minigames/ballrun/BallRunGame';
import type { MatchFinishPayload } from '@/types/match';

export function H2hBallRunMatch({
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
    <NeonBallRunGame
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
