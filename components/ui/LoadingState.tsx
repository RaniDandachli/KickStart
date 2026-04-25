import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Props = {
  message: string;
  size?: 'small' | 'large';
};

/** Consistent loading affordance — use copy like “Loading your wallet…” / “Loading live queues…”. */
export function LoadingState({ message, size = 'large' }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size={size} color="#FFD700" />
      <Text style={styles.txt}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  txt: {
    color: 'rgba(226, 232, 240, 0.92)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
