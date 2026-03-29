import { type PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

import { theme } from '@/lib/theme';

/** Light “cabinet card” on the navy arcade floor. */
export function Card({ children, className, ...rest }: PropsWithChildren<ViewProps & { className?: string }>) {
  return (
    <View
      className={`rounded-2xl border-2 border-amber-400/55 bg-white p-5 ${className ?? ''}`}
      style={theme.shadow.card}
      {...rest}
    >
      {children}
    </View>
  );
}
