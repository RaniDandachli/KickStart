import { QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useState } from 'react';

import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { createAppQueryClient } from '@/lib/queryClient';

function AuthBootstrapper({ children }: PropsWithChildren) {
  useAuthBootstrap();
  return <>{children}</>;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [client] = useState(createAppQueryClient);
  return (
    <QueryClientProvider client={client}>
      <AuthBootstrapper>{children}</AuthBootstrapper>
    </QueryClientProvider>
  );
}
