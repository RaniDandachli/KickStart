import { type PropsWithChildren } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { arcade } from '@/lib/arcadeTheme';

/** Extra space so scroll content clears the bottom tab bar (icons + labels). */
const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 54 : 56;

/**
 * Full-screen deep navy floor with subtle depth (no proprietary assets).
 */
export function ArcadeFloor({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 10) + TAB_BAR_CLEARANCE;

  return (
    <LinearGradient colors={[arcade.navy0, arcade.navy2, arcade.navy1]} style={styles.flex} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
      <StatusBar style="light" />
      <View style={styles.gridHint} pointerEvents="none" />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  gridHint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
});
