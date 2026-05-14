import TapDashGame from '@/minigames/tapdash/TapDashGame';
import type { MatchFinishPayload } from '@/types/match';

export function H2hTapDashMatch({
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
  /** Host already submitted score when creating async pending — poll only, do not POST again. */
  asyncHostSkipSubmit?: boolean;
}) {
  return (
    <TapDashGame
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
