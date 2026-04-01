import { Stack } from 'expo-router';

import { theme } from '@/lib/theme';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TournamentsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
