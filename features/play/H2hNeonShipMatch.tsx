import NeonShipScreen from '@/minigames/neonship/NeonShipScreen';
import type { MatchFinishPayload } from '@/types/match';

export function H2hNeonShipMatch({
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
    <NeonShipScreen
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
