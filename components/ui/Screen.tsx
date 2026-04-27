import { type PropsWithChildren, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeNeonBackground } from '@/components/arcade/HomeNeonBackground';
import { useWebUsesTopTabBar } from '@/hooks/useWebUsesTopTabBar';
import { APP_SCREEN_GRADIENT_COLORS, APP_SCREEN_GRADIENT_LOCATIONS } from '@/lib/runitArcadeTheme';

export function Screen({
  children,
  scroll = true,
  className,
}: PropsWithChildren<{ scroll?: boolean; className?: string }>) {
  const insets = useSafeAreaInsets();
  const webTopTabs = useWebUsesTopTabBar();

  /** Extra space so scrollable screens clear bottom tab bars (esp. mobile Safari + Expo web tabs). */
  const bottomPad = useMemo(() => {
    const base = Math.max(insets.bottom, 10);
    if (Platform.OS !== 'web') return base + 22;
    // Narrow web: tall glass bottom tab bar + margins (~see getAppTabBarStyle webMobileBottom).
    if (!webTopTabs) return base + 100;
    return base + 56;
  }, [insets.bottom, webTopTabs]);

  const topPad = Math.max(insets.top, 0) + 2;

  const inner = scroll ? (
    <ScrollView
      className="flex-1"
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, { paddingTop: topPad, paddingBottom: bottomPad }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1 px-5" style={{ paddingTop: topPad }}>
      {children}
    </View>
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
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <SafeAreaView
        className={`flex-1 ${className ?? ''}`}
        style={styles.safeArea}
        edges={['left', 'right', 'bottom']}
      >
        {inner}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, minHeight: 0 },
  /** Lets nested flex layouts shrink so RN Web ScrollView can scroll on iOS Safari (body scroll is off). */
  scrollView: { flex: 1, minHeight: 0 },
  /** Slightly wider gutters read more “product” on phone + web. */
  scrollContent: { paddingHorizontal: 20 },
});
