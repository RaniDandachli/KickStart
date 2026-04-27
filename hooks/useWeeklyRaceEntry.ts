import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { weeklyRaceDayKey } from '@/lib/weeklyRace';
import { fetchWeeklyRaceEntry } from '@/services/api/weeklyRace';
import { useAuthStore } from '@/store/authStore';

export function useWeeklyRaceEntry() {
  const uid = useAuthStore((s) => s.user?.id);
  const dayKey = weeklyRaceDayKey();
  return useQuery({
    queryKey: queryKeys.weeklyRace(dayKey),
    queryFn: () => fetchWeeklyRaceEntry(dayKey),
    enabled: ENABLE_BACKEND && !!uid,
  });
}
