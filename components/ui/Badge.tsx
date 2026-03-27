import { Text, View } from 'react-native';

const toneMap: Record<string, string> = {
  default: 'bg-ink-700 border-white/10 text-white',
  success: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200',
  warning: 'bg-amber-500/15 border-amber-400/40 text-amber-100',
  danger: 'bg-red-500/15 border-red-400/40 text-red-200',
  neon: 'bg-neon-lime/20 border-neon-lime/50 text-neon-lime',
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
      <Text className="text-xs font-semibold uppercase tracking-wide">{label}</Text>
    </View>
  );
}
