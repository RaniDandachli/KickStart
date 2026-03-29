import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { arcade } from '@/lib/arcadeTheme';

/**
 * Default shell for in-app screens: deep navy arcade floor + light status bar.
 * Scroll content gets bottom padding so lists clear above the tab bar comfortably.
 *
 * Put **headings and body copy** that sit **directly on the gradient** in light colors
 * (`text-white`, `text-slate-100`, `text-slate-300`). Reserve `text-slate-900` for text
 * on light surfaces (e.g. `Card`).
 */
export function Screen({
  children,
  scroll = true,
  className,
}: PropsWithChildren<{ scroll?: boolean; className?: string }>) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10) + 28;

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
      colors={[arcade.navy0, arcade.navy2, arcade.navy1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.flex}
    >
      <StatusBar style="light" />
      <SafeAreaView className={`flex-1 ${className ?? ''}`} edges={['top', 'left', 'right']}>
        {inner}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
});
