import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/store/authStore';
import { useDemoRedeemTicketsStore } from '@/store/demoRedeemTicketsStore';

/** Redeem tickets balance for Prizes catalog (demo store or `profiles.redeem_tickets`). */
export function useRedeemTicketsDisplay(): number {
  const demo = useDemoRedeemTicketsStore((s) => s.tickets);
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  if (ENABLE_BACKEND) {
    return profileQ.data?.redeem_tickets ?? 0;
  }
  return demo;
}
