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
    />
  );
}
