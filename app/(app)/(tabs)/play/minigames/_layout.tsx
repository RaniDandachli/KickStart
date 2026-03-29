import { Stack } from 'expo-router';

import { theme } from '@/lib/theme';

export default function MinigamesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
