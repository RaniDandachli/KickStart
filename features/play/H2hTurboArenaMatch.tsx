import TurboArenaGame from '@/minigames/turboarenagame/TurboArenagame';
import type { MatchFinishPayload } from '@/types/match';

export function H2hTurboArenaMatch({
  matchSessionId,
  localPlayerId,
  opponentId,
  opponentDisplayName,
  onComplete,
  asyncHostSkipSubmit,
}: {
  matchSessionId: string;
  localPlayerId: string;
  opponentId: string;
  opponentDisplayName: string;
  onComplete: (p: MatchFinishPayload) => void;
  asyncHostSkipSubmit?: boolean;
}) {
  return (
    <TurboArenaGame
      h2hSkillContest={{
        matchSessionId,
        localPlayerId,
        opponentId,
        opponentDisplayName,
        onComplete,
        asyncHostSkipSubmit,
      }}
    />
  );
}
