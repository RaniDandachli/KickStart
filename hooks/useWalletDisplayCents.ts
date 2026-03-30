import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { useDemoWalletStore } from '@/store/demoWalletStore';
import { useAuthStore } from '@/store/authStore';

/** Wallet balance in cents: live profile when backend on, else demo store (guest). */
export function useWalletDisplayCents(): number {
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const demoCents = useDemoWalletStore((s) => s.walletCents);

  if (ENABLE_BACKEND && profileQ.data) {
    return profileQ.data.wallet_cents ?? 0;
  }
  return demoCents;
}
