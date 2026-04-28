import { ShapeDashH2hHost } from '@/minigames/shapedash/ShapeDashH2hHost';

import type { H2hSkillContestBundle } from '@/types/match';

/** Head-to-head: Shape Dash Marathon only — higher distance wins. */
export function H2hShapeDashMatch({
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
  onComplete: H2hSkillContestBundle['onComplete'];
}) {
  return (
    <ShapeDashH2hHost
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
