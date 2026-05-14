import CyberRoadScreen from '@/minigames/cyberroad/CyberRoadScreen';
import type { MatchFinishPayload } from '@/types/match';

export function H2hCyberRoadMatch({
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
    <CyberRoadScreen
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
