import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { runit } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';

/**
 * Web-only: when signed out, show compact Sign in / Sign up in the top-right so the real tab shell
 * stays usable without a blocking welcome screen.
 */
export function WebBrowseAuthBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  if (Platform.OS !== 'web' || status !== 'signedOut') {
    return null;
  }

  /** Align with top tab bar row (see getAppTabBarStyle padding). */
  const top = Math.max(insets.top, 10) + 12;
  const right = Math.max(insets.right, 12);

  return (
    <View style={[styles.wrap, { top, right }]} pointerEvents="box-none">
      <View style={styles.row}>
        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.signIn}>Sign in</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(auth)/sign-up')}
          style={({ pressed }) => [styles.pill, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.signUp}>Sign up</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 2000,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  signIn: {
    color: runit.neonCyan,
    fontSize: 14,
    fontWeight: '800',
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(236, 72, 153, 0.25)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(236, 72, 153, 0.55)',
  },
  signUp: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
