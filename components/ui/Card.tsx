import { type PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

export function Card({ children, className, ...rest }: PropsWithChildren<ViewProps & { className?: string }>) {
  return (
    <View className={`rounded-2xl border border-white/10 bg-ink-800/90 p-4 ${className ?? ''}`} {...rest}>
      {children}
    </View>
  );
}
