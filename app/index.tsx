import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { ALLOW_GUEST_MODE, ENABLE_BACKEND } from '@/constants/featureFlags';
import { getHasSeenWelcome } from '@/lib/onboardingStorage';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const status = useAuthStore((s) => s.status);
  const [welcome, setWelcome] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void getHasSeenWelcome().then(setWelcome);
  }, []);

  /** Web: land on the real home shell first; Sign in / Sign up live in the tab chrome (see WebBrowseAuthBar). */
  if (Platform.OS === 'web') {
    if (ENABLE_BACKEND && status === 'loading') return null;
    return <Redirect href="/(app)/(tabs)" />;
  }

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
