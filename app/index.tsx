import { Redirect } from 'expo-router';

import { ALLOW_GUEST_MODE } from '@/constants/featureFlags';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const status = useAuthStore((s) => s.status);

  if (ALLOW_GUEST_MODE) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  if (status === 'loading') return null;

  if (status === 'signedOut') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(app)/(tabs)" />;
}
