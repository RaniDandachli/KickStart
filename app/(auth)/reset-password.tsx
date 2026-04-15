import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { parseRecoveryTokensFromUrl } from '@/lib/authPasswordRecovery';
import { formatAuthError } from '@/lib/authMessages';
import { runit, runitFont, runitTextGlowCyan } from '@/lib/runitArcadeTheme';
import { getSupabase } from '@/supabase/client';

type Phase = 'loading' | 'ready' | 'need_link';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const markReady = useCallback(() => {
    clearFallback();
    setPhase('ready');
  }, [clearFallback]);

  useEffect(() => {
    if (!ENABLE_BACKEND) {
      setPhase('need_link');
      return;
    }

    const supabase = getSupabase();
    let cancelled = false;

    const tryApplyUrl = async (url: string | null) => {
      if (!url || cancelled) return;
      const tokens = parseRecoveryTokensFromUrl(url);
      if (!tokens) return;
      const { error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (!cancelled && !error) markReady();
    };

    void Linking.getInitialURL().then((u) => void tryApplyUrl(u));

    const linkSub = Linking.addEventListener('url', (e) => {
      void tryApplyUrl(e.url);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') markReady();
    });

    fallbackTimerRef.current = setTimeout(() => {
      if (cancelled) return;
      setPhase((p) => (p === 'loading' ? 'need_link' : p));
    }, 2500);

    return () => {
      cancelled = true;
      clearFallback();
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, [markReady, clearFallback]);

  async function onSubmit() {
    const p = password.trim();
    if (p.length < 8) {
      Alert.alert('RunitArcade', 'Use at least 8 characters.');
      return;
    }
    if (p !== password2.trim()) {
      Alert.alert('RunitArcade', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: p });
      if (error) throw error;
      Alert.alert('Password updated', 'You can sign in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/sign-in') },
      ]);
    } catch (e: unknown) {
      Alert.alert('RunitArcade', formatAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  if (!ENABLE_BACKEND) {
    return (
      <Screen>
        <Text style={styles.body}>
          Password reset needs an online account. Connect to the internet and try again from the sign-in screen, or contact support.
        </Text>
        <AppButton title="Back to sign in" variant="secondary" className="mt-4" onPress={() => router.replace('/(auth)/sign-in')} />
      </Screen>
    );
  }

  if (phase === 'loading') {
    return (
      <Screen>
        <Text style={styles.body}>Opening your reset link…</Text>
      </Screen>
    );
  }

  if (phase === 'need_link') {
    return (
      <Screen>
        <Text style={styles.title}>Use the email link</Text>
        <Text style={styles.body}>
          Open the password reset email on this device and tap the link. If you opened this screen without coming from that link, go back and request a new reset from Sign in → Forgot password.
        </Text>
        <AppButton title="Back to sign in" variant="secondary" className="mt-6" onPress={() => router.replace('/(auth)/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <LinearGradient colors={[runit.neonCyan, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.kicker}>SECURE RESET</Text>
        <Text style={[styles.heroTitle, { fontFamily: runitFont.black }, runitTextGlowCyan]}>NEW PASSWORD</Text>
        <Text style={styles.sub}>Choose a strong password for your account.</Text>
      </LinearGradient>
      <KCTextInput label="New password" secureTextEntry value={password} onChangeText={setPassword} />
      <KCTextInput label="Confirm password" secureTextEntry value={password2} onChangeText={setPassword2} />
      <AppButton title="Update password" loading={loading} onPress={() => void onSubmit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: 20,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  kicker: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 6,
  },
  heroTitle: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 24,
    letterSpacing: 2,
    marginBottom: 8,
  },
  sub: {
    textAlign: 'center',
    color: 'rgba(226,232,240,0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
  body: { fontSize: 14, color: 'rgba(148,163,184,0.95)', lineHeight: 20 },
});
