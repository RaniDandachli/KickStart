import { StripeProvider } from '@stripe/stripe-react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect, useState } from 'react';

import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { configureArcadeNotificationBehavior } from '@/lib/arcadeLocalNotifications';
import { createAppQueryClient } from '@/lib/queryClient';

function AuthBootstrapper({ children }: PropsWithChildren) {
  useAuthBootstrap();
  return <>{children}</>;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [client] = useState(createAppQueryClient);
  const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

  useEffect(() => {
    configureArcadeNotificationBehavior();
  }, []);

  const tree = (
    <QueryClientProvider client={client}>
      <AuthBootstrapper>{children}</AuthBootstrapper>
    </QueryClientProvider>
  );

  if (key.trim()) {
    return <StripeProvider publishableKey={key.trim()}>{tree}</StripeProvider>;
  }

  return tree;
}
