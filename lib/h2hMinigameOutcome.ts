import type { MatchFinishPayload } from '@/types/match';

/** Honest Tap Dash (gate count) outcome for H2H — no scripted variance. */
export function finalizeH2hTapDashScores(
  selfRun: number,
  opponentRun: number,
  localPlayerId: string,
  opponentId: string,
): MatchFinishPayload {
  const self = Math.max(0, Math.floor(selfRun));
  const opp = Math.max(0, Math.floor(opponentRun));
  if (self === opp) {
    return { winnerId: 'draw', finalScore: { self, opponent: opp }, reason: 'normal' };
  }
  if (self > opp) {
    return { winnerId: localPlayerId, finalScore: { self, opponent: opp }, reason: 'normal' };
  }
  return { winnerId: opponentId, finalScore: { self, opponent: opp }, reason: 'normal' };
}
