import { type PropsWithChildren } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeNeonBackground } from '@/components/arcade/HomeNeonBackground';
import { APP_SCREEN_GRADIENT_COLORS, APP_SCREEN_GRADIENT_LOCATIONS } from '@/lib/runitArcadeTheme';

export function Screen({
  children,
  scroll = true,
  className,
}: PropsWithChildren<{ scroll?: boolean; className?: string }>) {
  const insets = useSafeAreaInsets();
  /** Extra space so scrollable screens clear bottom tab bars (esp. mobile Safari + Expo web tabs). */
  const bottomPad = Math.max(insets.bottom, 10) + (Platform.OS === 'web' ? 56 : 28);

  const inner = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1 px-4">{children}</View>
  );

  return (
    <LinearGradient
      colors={[...APP_SCREEN_GRADIENT_COLORS]}
      locations={[...APP_SCREEN_GRADIENT_LOCATIONS]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.flex}
    >
      <HomeNeonBackground />
      <StatusBar style="light" />
      <SafeAreaView className={`flex-1 ${className ?? ''}`} edges={['top', 'left', 'right']}>
        {inner}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
});
