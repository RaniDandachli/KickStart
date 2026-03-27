import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';
import { useAuthStore } from '@/store/authStore';
import { updateProfileFields } from '@/services/api/profiles';

export default function OnboardingScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const [displayName, setDisplayName] = useState('');
  const [region, setRegion] = useState('na');
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!userId) {
      Alert.alert('KickClash', 'Not signed in');
      return;
    }
    setLoading(true);
    try {
      await updateProfileFields(userId, {
        display_name: displayName.trim() || null,
        region,
        avatar_url: null,
      });
      router.replace('/(app)/(tabs)');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not save';
      Alert.alert('KickClash', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text className="mb-4 text-lg font-bold text-white">Dial in your profile</Text>
      <KCTextInput label="Display name" value={displayName} onChangeText={setDisplayName} />
      <KCTextInput label="Region code (na, eu, ...)" autoCapitalize="none" value={region} onChangeText={setRegion} />
      <AppButton title="Save & enter" loading={loading} onPress={() => void save()} />
    </Screen>
  );
}
