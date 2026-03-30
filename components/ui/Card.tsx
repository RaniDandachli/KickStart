import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

export function Card({ children, className, style, ...rest }: PropsWithChildren<ViewProps & { className?: string }>) {
  return (
    <View style={[styles.card, style]} className={className ?? ''} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(157, 78, 237, 0.4)',
    backgroundColor: 'rgba(12, 6, 22, 0.85)',
    padding: 16,
    marginBottom: 12,
    shadowColor: 'rgba(157, 78, 237, 0.35)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
  },
});
