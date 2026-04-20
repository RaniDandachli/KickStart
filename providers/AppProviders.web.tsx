import { QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect, useState } from 'react';

import { MatchmakingQueueRunner } from '@/features/play/MatchmakingQueueRunner';
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { configureArcadeNotificationBehavior } from '@/lib/arcadeLocalNotifications';
import { createAppQueryClient } from '@/lib/queryClient';

function AuthBootstrapper({ children }: PropsWithChildren) {
  useAuthBootstrap();
  return <>{children}</>;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [client] = useState(createAppQueryClient);

  useEffect(() => {
    configureArcadeNotificationBehavior();
  }, []);

  return (
    <QueryClientProvider client={client}>
      <AuthBootstrapper>
        {children}
        {/** After routes so match-found overlay / modal stacks above the app (esp. web + iOS Safari). */}
        <MatchmakingQueueRunner />
      </AuthBootstrapper>
    </QueryClientProvider>
  );
}
