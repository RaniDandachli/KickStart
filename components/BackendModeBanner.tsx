import { StyleSheet, Text, View } from 'react-native';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { isSupabaseLikelyConfigured } from '@/lib/env';

/**
 * Explains guest vs live backend so testers are not confused about “mock” money or matchmaking.
 */
export function BackendModeBanner() {
  if (!ENABLE_BACKEND) {
    return (
      <View style={[styles.box, styles.demo]}>
        <Text style={styles.title}>Practice mode</Text>
        <Text style={styles.body}>
          You&apos;re playing on this device only — guest wallet and casual match previews don&apos;t sync to the cloud. Sign in for live
          contests, wallet, and matchmaking when available.
        </Text>
      </View>
    );
  }

  if (!isSupabaseLikelyConfigured()) {
    return (
      <View style={[styles.box, styles.warn]}>
        <Text style={styles.title}>Can&apos;t reach game services</Text>
        <Text style={styles.body}>
          This build isn&apos;t connected correctly. Check your internet connection, update the app, or try again later.
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  box: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  demo: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  warn: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  title: { color: '#f8fafc', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  body: { color: 'rgba(226, 232, 240, 0.92)', fontSize: 12, lineHeight: 17 },
});
