export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  profileByUsername: (username: string) => ['profileUsername', username] as const,
  tournaments: (filters?: Record<string, string>) => ['tournaments', filters ?? {}] as const,
  tournament: (id: string) => ['tournament', id] as const,
  tournamentRules: (id: string) => ['tournamentRules', id] as const,
  leaderboard: (scope: string, seasonId: string | null, region: string) =>
    ['leaderboard', scope, seasonId, region] as const,
  transactions: (userId: string) => ['transactions', userId] as const,
  seasonActive: () => ['seasonActive'] as const,
  ratings: (userId: string) => ['ratings', userId] as const,
  userStats: (userId: string) => ['userStats', userId] as const,
};
