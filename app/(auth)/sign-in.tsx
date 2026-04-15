import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';
import { setHasSeenWelcome } from '@/lib/onboardingStorage';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { formatAuthError } from '@/lib/authMessages';
import { getSupabase } from '@/supabase/client';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await setHasSeenWelcome();
      router.replace('/(app)/(tabs)');
    } catch (e: unknown) {
      Alert.alert("Can't sign in", formatAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <LinearGradient colors={[runit.neonPurple, runit.neonPink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.kicker}>WELCOME BACK</Text>
        <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>SIGN IN</Text>
        <Text style={styles.sub}>Use your email and password to sync your profile.</Text>
      </LinearGradient>
      <KCTextInput label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <KCTextInput label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <AppButton title="Sign in" loading={loading} onPress={() => void onSubmit()} />
      <Link href="/(auth)/sign-up" className="mt-4">
        <Text style={styles.link}>Need an account?</Text>
      </Link>
      <Link href="/(auth)/forgot-password" className="mt-2">
        <Text style={styles.muted}>Forgot password</Text>
      </Link>
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
  title: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 26,
    letterSpacing: 2,
    marginBottom: 8,
  },
  sub: {
    textAlign: 'center',
    color: 'rgba(226,232,240,0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  link: { textAlign: 'center', fontSize: 15, fontWeight: '800', color: runit.neonCyan },
  muted: { textAlign: 'center', fontSize: 13, color: 'rgba(148,163,184,0.85)' },
});
