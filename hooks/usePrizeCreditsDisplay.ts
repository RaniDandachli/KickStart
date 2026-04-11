import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { useDemoPrizeCreditsStore } from '@/store/demoPrizeCreditsStore';
import { useAuthStore } from '@/store/authStore';

/** Prize credits: live profile when backend on, else demo store. */
export function usePrizeCreditsDisplay(): number {
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const demo = useDemoPrizeCreditsStore((s) => s.credits);

  if (ENABLE_BACKEND && uid) {
    return profileQ.data?.prize_credits ?? 0;
  }
  return demo;
}
