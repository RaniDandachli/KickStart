import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { theme } from '@/lib/theme';
import { stackAnimationDefaults } from '@/lib/navigationAnimations';

/** Mirrors play/minigames — nested under Events tab so Arcade stack is not polluted. */
const noSwipeBack =
  Platform.OS !== 'web'
    ? {
        gestureEnabled: false as const,
        ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: false as const } : {}),
      }
    : {};

export default function EventsMinigamesStackLayout() {
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
