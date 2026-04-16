import {
  Orbitron_400Regular,
  Orbitron_700Bold,
  Orbitron_900Black,
} from '@expo-google-fonts/orbitron';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { NeonArcadeSplash } from '@/components/splash/NeonArcadeSplash';
import { theme } from '@/lib/theme';
import { AppProviders } from '@/providers/AppProviders';

import '../global.css';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, err] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Orbitron_400Regular,
    Orbitron_700Bold,
    Orbitron_900Black,
    /** Required for web (incl. static export): Ionicon font must be in the synchronous font map. */
    ...Ionicons.font,
  });
  const [splashDone, setSplashDone] = useState(false);

  const onSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  useEffect(() => {
    if (err) throw err;
  }, [err]);

  useEffect(() => {
    if (loaded) {
      void SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <AppProviders>
        <StatusBar barStyle="light-content" />
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
      {!splashDone ? <NeonArcadeSplash onComplete={onSplashComplete} /> : null}
    </SafeAreaProvider>
  );
}
