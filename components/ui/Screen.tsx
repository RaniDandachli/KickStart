import { type PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({
  children,
  scroll = true,
  className,
}: PropsWithChildren<{ scroll?: boolean; className?: string }>) {
  if (scroll) {
    return (
      <SafeAreaView className={`flex-1 bg-ink-950 ${className ?? ''}`} edges={['top', 'left', 'right']}>
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView className={`flex-1 bg-ink-950 px-4 ${className ?? ''}`} edges={['top', 'left', 'right']}>
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}
