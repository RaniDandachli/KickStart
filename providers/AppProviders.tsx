import { StripeProvider } from '@stripe/stripe-react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect, useState } from 'react';

import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { configureArcadeNotificationBehavior } from '@/lib/arcadeLocalNotifications';
import { env } from '@/lib/env';
import { createAppQueryClient } from '@/lib/queryClient';

function AuthBootstrapper({ children }: PropsWithChildren) {
  useAuthBootstrap();
  return <>{children}</>;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [client] = useState(createAppQueryClient);
  const stripePk = env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();

  useEffect(() => {
    configureArcadeNotificationBehavior();
  }, []);

  const tree = (
    <QueryClientProvider client={client}>
      <AuthBootstrapper>{children}</AuthBootstrapper>
    </QueryClientProvider>
  );

  if (stripePk) {
    return <StripeProvider publishableKey={stripePk}>{tree}</StripeProvider>;
  }

  return tree;
}
