import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
      colors={['#06020e', '#12081f', '#0c0618', '#050208']}
      locations={[0, 0.35, 0.65, 1]}
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
});
