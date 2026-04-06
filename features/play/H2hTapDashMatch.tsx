import TapDashGame from '@/minigames/tapdash/TapDashGame';
import type { MatchFinishPayload } from '@/types/match';

export function H2hTapDashMatch({
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
    <TapDashGame
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
