import { Redirect, Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { ALLOW_GUEST_MODE } from '@/constants/featureFlags';
import { useRealtimeScaffold } from '@/hooks/useRealtimeScaffold';
import { useAuthStore } from '@/store/authStore';

export default function AuthenticatedLayout() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();

  useRealtimeScaffold(userId);

  useEffect(() => {
    if (ALLOW_GUEST_MODE) return;
    if (status === 'signedOut') {
      router.replace('/(auth)/sign-in');
    }
  }, [router, status]);

  if (!ALLOW_GUEST_MODE && status === 'loading') return null;

  if (!ALLOW_GUEST_MODE && status === 'signedOut') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Slot />;
}
