import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';
import { formatAuthError } from '@/lib/authMessages';
import { setHasSeenWelcome } from '@/lib/onboardingStorage';
import { runit, runitFont, runitTextGlowCyan } from '@/lib/runitArcadeTheme';
import { getSupabase } from '@/supabase/client';

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim().toLowerCase(),
            display_name: username.trim(),
          },
        },
      });
      if (error) throw error;
      await setHasSeenWelcome();
      // If email confirmation is off in Supabase, you get a session immediately.
      if (data.session) {
        router.replace('/(app)/(tabs)');
        return;
      }
      Alert.alert(
        'Confirm your email',
        'Your Supabase project requires confirming email before sign-in.\n\nTurn off “Confirm email” under Authentication → Providers → Email for instant sign-up while testing, then sign up again (or use the link in your email).',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }]
      );
    } catch (e: unknown) {
      Alert.alert('Run it', formatAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <LinearGradient colors={[runit.neonPurple, '#5a189a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.kicker}>JOIN THE FLOOR</Text>
        <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowCyan]}>CREATE ACCOUNT</Text>
        <Text style={styles.sub}>Pick a unique username for leaderboards. With email confirmation off in Supabase, you will jump straight in.</Text>
      </LinearGradient>
      <KCTextInput label="Username" autoCapitalize="none" value={username} onChangeText={setUsername} />
      <KCTextInput label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <KCTextInput label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <AppButton title="Sign up" loading={loading} onPress={() => void onSubmit()} />
      <Link href="/(auth)/sign-in" className="mt-4">
        <Text style={styles.link}>Already have an account?</Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: 16,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'rgba(0,240,255,0.25)',
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
  link: { textAlign: 'center', fontSize: 15, fontWeight: '800', color: runit.neonPink },
});
