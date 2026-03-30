import { Stack } from 'expo-router';

import { arcade } from '@/lib/arcadeTheme';
import { theme } from '@/lib/theme';

export default function PlayStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: arcade.navy1 },
        headerTintColor: theme.colors.gold,
        headerTitleStyle: { fontWeight: '900', color: '#F5F3FF', fontSize: 18 },
        contentStyle: { backgroundColor: arcade.navy1 },
      }}
    >
      {/* Hub + queues use in-screen headers so we always show a back control (tab deep-links have no stack history). */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="casual" options={{ headerShown: false }} />
      <Stack.Screen name="ranked" options={{ headerShown: false }} />
    </Stack>
  );
}
