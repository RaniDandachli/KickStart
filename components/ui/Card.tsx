import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { appBorderAccentMuted, runit } from '@/lib/runitArcadeTheme';

export function Card({ children, className, style, ...rest }: PropsWithChildren<ViewProps & { className?: string }>) {
  return (
    <View style={[styles.card, style]} className={className ?? ''} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: appBorderAccentMuted,
    backgroundColor: runit.glass,
    padding: 18,
    marginBottom: 14,
    shadowColor: 'rgba(168, 85, 247, 0.28)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 8,
  },
});
