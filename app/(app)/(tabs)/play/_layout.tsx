import { Stack } from 'expo-router';

import { arcade } from '@/lib/arcadeTheme';
import { runit } from '@/lib/runitArcadeTheme';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function PlayStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: arcade.navy1 },
        headerTintColor: runit.chrome,
        headerTitleStyle: { fontWeight: '900', color: '#F5F3FF', fontSize: 18 },
        contentStyle: { backgroundColor: arcade.navy1 },
      }}
    >
      {/* Hub + queues use in-screen headers so we always show a back control (tab deep-links have no stack history). */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="casual" options={{ headerShown: false }} />
      <Stack.Screen name="live-matches" options={{ headerShown: false }} />
      <Stack.Screen name="choose-contest" options={{ headerShown: false }} />
      <Stack.Screen name="ranked" options={{ headerShown: false }} />
      {/* Nested minigames stack — hide parent title bar ("minigames") for full-screen games */}
      <Stack.Screen name="minigames" options={{ headerShown: false }} />
    </Stack>
  );
}
