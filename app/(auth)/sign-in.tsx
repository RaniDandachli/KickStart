import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';
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
      router.replace('/(app)/(tabs)');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign in failed';
      Alert.alert('KickClash', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text className="mb-6 text-3xl font-black text-neon-lime">KickClash</Text>
      <KCTextInput label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <KCTextInput label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <AppButton title="Sign in" loading={loading} onPress={() => void onSubmit()} />
      <Link href="/(auth)/sign-up" className="mt-4">
        <Text className="text-center text-sm text-neon-cyan">Need an account?</Text>
      </Link>
      <Link href="/(auth)/forgot-password" className="mt-2">
        <Text className="text-center text-sm text-white/50">Forgot password (placeholder)</Text>
      </Link>
    </Screen>
  );
}
