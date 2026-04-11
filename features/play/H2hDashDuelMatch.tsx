import DashDuelScreen from '@/minigames/dashduel/DashDuelScreen';
import type { MatchFinishPayload } from '@/types/match';

export function H2hDashDuelMatch({
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
    <DashDuelScreen
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
