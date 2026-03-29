import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center justify-center rounded-2xl border border-amber-400/25 bg-slate-950/35 px-6 py-10">
      <Text className="mb-2 text-center text-lg font-black text-white">{title}</Text>
      {description ? (
        <Text className="mb-4 text-center text-sm font-medium text-slate-300">{description}</Text>
      ) : null}
      {actionLabel && onAction ? <AppButton title={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}
