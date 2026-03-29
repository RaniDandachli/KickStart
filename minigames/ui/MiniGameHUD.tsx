import { Text, View } from 'react-native';

import { theme } from '@/lib/theme';

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

interface Props {
  timeLeftMs: number;
  scoreP1: number;
  scoreP2: number;
  labelP1?: string;
  labelP2?: string;
  subtitle?: string;
}

export function MiniGameHUD({
  timeLeftMs,
  scoreP1,
  scoreP2,
  labelP1 = 'You',
  labelP2 = 'AI',
  subtitle,
}: Props) {
  return (
    <View className="w-full px-3 pt-2 pb-1" style={{ backgroundColor: theme.colors.backgroundDeep }}>
      {subtitle ? (
        <Text className="mb-1 text-center text-xs font-bold uppercase tracking-wide text-amber-300">{subtitle}</Text>
      ) : null}
      <View className="flex-row items-center justify-between">
        <View className="min-w-[88px] rounded-2xl border-2 border-fuchsia-400 bg-fuchsia-950/80 px-3 py-2">
          <Text className="text-[10px] font-black uppercase tracking-wide text-fuchsia-200">{labelP1}</Text>
          <Text className="text-2xl font-black text-amber-300">{Math.round(scoreP1)}</Text>
        </View>
        <View className="items-center rounded-2xl border-2 border-amber-400 bg-violet-900 px-4 py-2">
          <Text className="text-[10px] font-black uppercase tracking-widest text-amber-200">Time</Text>
          <Text className="font-mono text-2xl font-black text-white">{formatTime(timeLeftMs)}</Text>
        </View>
        <View className="min-w-[88px] items-end rounded-2xl border-2 border-cyan-400 bg-cyan-950/80 px-3 py-2">
          <Text className="text-[10px] font-black uppercase tracking-wide text-cyan-200">{labelP2}</Text>
          <Text className="text-2xl font-black text-cyan-200">{Math.round(scoreP2)}</Text>
        </View>
      </View>
    </View>
  );
}
