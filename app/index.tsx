import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { ALLOW_GUEST_MODE, ENABLE_BACKEND } from '@/constants/featureFlags';
import { getHasSeenWelcome } from '@/lib/onboardingStorage';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const status = useAuthStore((s) => s.status);
  const [welcome, setWelcome] = useState<boolean | null>(null);

  useEffect(() => {
    void getHasSeenWelcome().then(setWelcome);
  }, []);

  if (welcome === null || (ENABLE_BACKEND && status === 'loading')) {
    return null;
  }

  if (!welcome) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (ALLOW_GUEST_MODE) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  if (status === 'signedOut') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(app)/(tabs)" />;
}
