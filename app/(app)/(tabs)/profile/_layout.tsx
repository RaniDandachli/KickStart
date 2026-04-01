import { Stack } from 'expo-router';

import { theme } from '@/lib/theme';

/** Ensure tab root (You) stays under nested screens so Back from e.g. add-funds returns here, not Home. */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
