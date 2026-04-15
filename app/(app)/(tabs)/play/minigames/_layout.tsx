import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { theme } from '@/lib/theme';
import { stackAnimationDefaults } from '@/lib/navigationAnimations';

/** Full-screen drag minigames: disable native swipe-back so horizontal drags don't pop the screen. */
const noSwipeBack =
  Platform.OS !== 'web'
    ? {
        gestureEnabled: false as const,
        ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: false as const } : {}),
      }
    : {};

export default function MinigamesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        ...stackAnimationDefaults,
      }}
    >
      <Stack.Screen name="neon-dance" options={noSwipeBack} />
    </Stack>
  );
}
