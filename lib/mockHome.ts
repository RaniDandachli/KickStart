import type { LeaderboardSnapshotRow } from '@/types/database';

/** UI-only samples when database rows are empty (dev / first boot). */
export const mockRecentMatches = [
  { id: '1', result: 'W', score: '3-2', mode: 'Ranked', ago: '2h' },
  { id: '2', result: 'L', score: '1-2', mode: 'Casual', ago: '5h' },
  { id: '3', result: 'W', score: '2-0', mode: 'Ranked', ago: '1d' },
];

export function mockLeaderboardFallback(seasonId: string | null): LeaderboardSnapshotRow[] {
  const sid = seasonId ?? '00000000-0000-4000-8000-000000000001';
  return [
    {
      id: 'm1',
      season_id: sid,
      scope: 'global',
      region: 'global',
      user_id: 'u1',
      rank: 1,
      rating: 1688,
      wins: 120,
      win_rate: 0.62,
      streak: 4,
      rank_delta: 1,
      captured_at: new Date().toISOString(),
    },
    {
      id: 'm2',
      season_id: sid,
      scope: 'global',
      region: 'global',
      user_id: 'u2',
      rank: 2,
      rating: 1654,
      wins: 98,
      win_rate: 0.58,
      streak: -1,
      rank_delta: -1,
      captured_at: new Date().toISOString(),
    },
  ];
}
