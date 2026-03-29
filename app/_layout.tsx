import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { theme } from '@/lib/theme';
import { AppProviders } from '@/providers/AppProviders';

import '../global.css';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, err] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (err) throw err;
  }, [err]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <AppProviders>
        <StatusBar barStyle="dark-content" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#060d18' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AppProviders>
    </SafeAreaProvider>
  );
}
