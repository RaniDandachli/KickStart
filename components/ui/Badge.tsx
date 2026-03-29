import { Text, View } from 'react-native';

const toneMap: Record<string, string> = {
  default: 'bg-slate-100 border-slate-200',
  success: 'bg-emerald-50 border-emerald-200',
  warning: 'bg-amber-50 border-amber-200',
  danger: 'bg-red-50 border-red-200',
  neon: 'bg-emerald-50 border-emerald-200',
};

const toneText: Record<keyof typeof toneMap, string> = {
  default: 'text-slate-700',
  success: 'text-emerald-800',
  warning: 'text-amber-900',
  danger: 'text-red-800',
  neon: 'text-emerald-800',
};

export function Badge({
  label,
  tone = 'default',
  className,
}: {
  label: string;
  tone?: keyof typeof toneMap;
  className?: string;
}) {
  return (
    <View className={`self-start rounded-full border px-2 py-0.5 ${toneMap[tone]} ${className ?? ''}`}>
      <Text className={`text-xs font-semibold uppercase tracking-wide ${toneText[tone]}`}>{label}</Text>
    </View>
  );
}
