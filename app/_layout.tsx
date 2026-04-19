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
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { NeonArcadeSplash } from '@/components/splash/NeonArcadeSplash';
import { runit } from '@/lib/runitArcadeTheme';
import { AppProviders } from '@/providers/AppProviders';

import '../global.css';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

/**
 * RN Web maps `colors.card` onto the bottom tab bar shell. `DarkTheme` uses near-black rgb(18,18,18),
 * which reads as a solid black strip on iPhone Safari behind our glass `tabBarBackground`.
 */
const WebArcadeNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
    card: 'transparent',
    border: 'transparent',
  },
};

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

  const stack = (
    <>
      <StatusBar barStyle="light-content" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: runit.bgDeep },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );

  return (
    <SafeAreaProvider>
      <AppProviders>
        {Platform.OS === 'web' ? <ThemeProvider value={WebArcadeNavigationTheme}>{stack}</ThemeProvider> : stack}
      </AppProviders>
      {!splashDone ? <NeonArcadeSplash onComplete={onSplashComplete} /> : null}
    </SafeAreaProvider>
  );
}
