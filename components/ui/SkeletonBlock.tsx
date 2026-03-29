import { View } from 'react-native';

export function SkeletonBlock({ className }: { className?: string }) {
  return <View className={`animate-pulse rounded-xl bg-white/15 ${className ?? 'h-4 w-full'}`} />;
}
