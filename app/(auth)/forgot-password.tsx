import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { formatAuthError } from '@/lib/authMessages';
import { runit as runitTheme, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { getSupabase } from '@/supabase/client';

/**
 * Sends a Supabase recovery email. Add the redirect URL to Supabase Dashboard → Authentication → URL Configuration
 * (e.g. `runit://` paths from `Linking.createURL`, plus Expo dev URLs if needed).
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('RunitArcade', 'Enter your email address.');
      return;
    }
    if (!ENABLE_BACKEND) {
      Alert.alert(
        'RunitArcade',
        'Password reset requires an account on the server. Enable the backend in your build or use Sign in when online.',
      );
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();
      const redirectTo = Linking.createURL('/(auth)/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (error) throw error;
      setSent(true);
    } catch (e: unknown) {
      Alert.alert('RunitArcade', formatAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <LinearGradient colors={[runitTheme.neonPurple, runitTheme.neonPink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.kicker}>ACCOUNT</Text>
        <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>RESET PASSWORD</Text>
        <Text style={styles.sub}>We&apos;ll email you a secure link to choose a new password.</Text>
      </LinearGradient>

      {sent ? (
        <View>
          <Text style={styles.success}>
            Check <Text style={styles.successEm}>{email.trim()}</Text> for a message from us. Open the link on this device to set a new password.
          </Text>
          <AppButton title="Back to sign in" className="mt-6" onPress={() => router.replace('/(auth)/sign-in')} />
        </View>
      ) : (
        <>
          <KCTextInput
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
          <AppButton title="Send reset link" loading={loading} onPress={() => void onSubmit()} />
          <AppButton title="Cancel" variant="ghost" className="mt-2" onPress={() => router.back()} />
        </>
      )}
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
  success: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(226,232,240,0.95)',
  },
  successEm: { fontWeight: '800', color: runitTheme.neonCyan },
});
