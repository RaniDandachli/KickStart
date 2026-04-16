import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchTournamentById, fetchTournamentRules, fetchTournaments, joinTournament } from '@/services/api/tournaments';

export function useTournaments(openOnly = false) {
  return useQuery({
    queryKey: queryKeys.tournaments({ open: openOnly ? '1' : '0' }),
    queryFn: () => fetchTournaments(openOnly),
    enabled: ENABLE_BACKEND,
  });
}

export function useTournament(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tournament(id ?? ''),
    queryFn: () => fetchTournamentById(id!),
    enabled: ENABLE_BACKEND && !!id,
  });
}

export function useTournamentRules(tournamentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tournamentRules(tournamentId ?? ''),
    queryFn: () => fetchTournamentRules(tournamentId!),
    enabled: ENABLE_BACKEND && !!tournamentId,
  });
}

export function useJoinTournament(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tournamentId: string) => {
      if (!ENABLE_BACKEND) return;
      if (!userId) throw new Error('Not signed in');
      const r = await joinTournament(tournamentId);
      if (!r.ok) throw new Error(r.error ?? 'Could not join tournament');
    },
    onSuccess: (_, tournamentId) => {
      void qc.invalidateQueries({ queryKey: ['tournaments'] });
      void qc.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      void qc.invalidateQueries({ queryKey: queryKeys.tournamentBracket(tournamentId) });
      if (userId) {
        void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        void qc.invalidateQueries({ queryKey: queryKeys.transactions(userId) });
      }
    },
  });
}
