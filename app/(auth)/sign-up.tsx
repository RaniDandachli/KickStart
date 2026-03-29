import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';
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
      const { error } = await supabase.auth.signUp({
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
      Alert.alert(
        'Check your inbox',
        'Confirm your email if required by your Supabase project, then sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }]
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign up failed';
      Alert.alert('Run it', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View className="mb-4 rounded-2xl border-2 border-amber-400 bg-fuchsia-600 px-4 py-3">
        <Text className="text-center text-xs font-black uppercase tracking-widest text-amber-200">Join the floor</Text>
        <Text className="text-center text-2xl font-black text-white">Create your profile</Text>
      </View>
      <Text className="mb-4 text-sm font-medium text-slate-300">Username must be unique — used on leaderboards.</Text>
      <KCTextInput label="Username" autoCapitalize="none" value={username} onChangeText={setUsername} />
      <KCTextInput label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <KCTextInput label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <AppButton title="Sign up" loading={loading} onPress={() => void onSubmit()} />
      <Link href="/(auth)/sign-in" className="mt-4">
        <Text className="text-center text-sm font-bold text-amber-300">Already have an account?</Text>
      </Link>
    </Screen>
  );
}
