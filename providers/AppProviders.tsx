import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import { AppProviders as NativeProviders } from './AppProviders.native';
import { AppProviders as WebProviders } from './AppProviders.web';

/** Picks web vs native provider tree. */
export function AppProviders({ children }: PropsWithChildren) {
  if (Platform.OS === 'web') {
    return <WebProviders>{children}</WebProviders>;
  }
  return <NativeProviders>{children}</NativeProviders>;
}
