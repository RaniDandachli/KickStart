import { randomCupOpponentName } from '@/lib/cupTournaments';
import { getRoundLabel, randomOpponentName } from '@/lib/dailyFreeTournament';

export type BracketPathCellStatus = 'upcoming' | 'live' | 'won' | 'lost' | 'skipped';

export type BracketPathCell = {
  roundIndex1Based: number;
  roundLabel: string;
  opponentName: string;
  status: BracketPathCellStatus;
};

export type BuildPathBracketArgs = {
  totalRounds: number;
  nextRound: number;
  eliminated: boolean;
  loseAtRound: number;
  youName: string;
  userKey: string;
  mode: 'daily' | 'cup';
  cupId?: string;
};

/**
 * Linear single-elimination path (one match per round) for scripted daily/cup runs.
 */
export function buildFakeBracketPath(args: BuildPathBracketArgs): BracketPathCell[] {
  const { totalRounds, nextRound, eliminated, loseAtRound, userKey, mode, cupId } = args;
  const cells: BracketPathCell[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    const label = getRoundLabel(r);
    const opp =
      mode === 'cup' && cupId
        ? randomCupOpponentName(userKey, r, cupId)
        : randomOpponentName(userKey, r);

    let status: BracketPathCellStatus;
    if (eliminated) {
      if (r < loseAtRound) status = 'won';
      else if (r === loseAtRound) status = 'lost';
      else status = 'skipped';
    } else if (nextRound > totalRounds) {
      status = 'won';
    } else if (r < nextRound) {
      status = 'won';
    } else if (r === nextRound) {
      status = 'live';
    } else {
      status = 'upcoming';
    }

    cells.push({
      roundIndex1Based: r,
      roundLabel: label,
      opponentName: opp,
      status,
    });
  }

  void args.youName;
  return cells;
}
