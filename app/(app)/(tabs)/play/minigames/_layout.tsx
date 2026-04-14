import { Stack } from 'expo-router';

import { theme } from '@/lib/theme';
import { stackAnimationDefaults } from '@/lib/navigationAnimations';

export default function MinigamesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        ...stackAnimationDefaults,
      }}
    />
  );
}
