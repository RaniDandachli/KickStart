import { useMemo } from 'react';

import { ShapeDashH2hHost } from '@/minigames/shapedash/ShapeDashH2hHost';

import type { H2hSkillContestBundle } from '@/types/match';

/** Head-to-head: Shape Dash Marathon only — higher distance wins. */
export function H2hShapeDashMatch({
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
  onComplete: H2hSkillContestBundle['onComplete'];
  asyncHostSkipSubmit?: boolean;
}) {
  const h2hSkillContest = useMemo<H2hSkillContestBundle>(
    () => ({
      matchSessionId,
      localPlayerId,
      opponentId,
      opponentDisplayName,
      onComplete,
      asyncHostSkipSubmit,
    }),
    [matchSessionId, localPlayerId, opponentId, opponentDisplayName, onComplete, asyncHostSkipSubmit],
  );

  return <ShapeDashH2hHost h2hSkillContest={h2hSkillContest} />;
}
