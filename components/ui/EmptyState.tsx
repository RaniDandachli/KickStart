import { Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { appBorderAccentMuted } from '@/lib/runitArcadeTheme';

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
    <View
      className="items-center justify-center rounded-[18px] px-6 py-10"
      style={{
        borderWidth: 1,
        borderColor: appBorderAccentMuted,
        backgroundColor: 'rgba(12, 6, 22, 0.72)',
      }}
    >
      <Text className="mb-2 text-center text-lg font-black tracking-wide text-white">{title}</Text>
      {description ? (
        <Text className="mb-4 max-w-sm text-center text-sm font-medium leading-5 text-slate-300">{description}</Text>
      ) : null}
      {actionLabel && onAction ? <AppButton title={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}
