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
        <Text style={styles.title}>Offline demo mode</Text>
        <Text style={styles.body}>
          Guest access, local wallet, and mock matchmaking — nothing is saved to Supabase. Set EXPO_PUBLIC_ENABLE_BACKEND=true and real
          Supabase keys in .env for live H2H, wallet debits, and prizes.
        </Text>
      </View>
    );
  }

  if (!isSupabaseLikelyConfigured()) {
    return (
      <View style={[styles.box, styles.warn]}>
        <Text style={styles.title}>Supabase not configured</Text>
        <Text style={styles.body}>
          Backend is enabled but URL/key still look like placeholders. Update EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
          in .env, then restart Expo.
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
