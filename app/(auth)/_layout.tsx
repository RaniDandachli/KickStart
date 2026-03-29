import { Stack } from 'expo-router';

import { theme } from '@/lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '800', color: theme.colors.text },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      <Stack.Screen name="onboarding" options={{ title: 'Profile setup' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
    </Stack>
  );
}
