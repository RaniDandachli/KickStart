import { Modal, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { theme } from '@/lib/theme';

interface Props {
  visible: boolean;
  title: string;
  scoreP1: number;
  scoreP2: number;
  labelP1?: string;
  labelP2?: string;
  onRematch: () => void;
  onMenu: () => void;
}

export function MiniResultsModal({
  visible,
  title,
  scoreP1,
  scoreP2,
  labelP1 = 'You',
  labelP2 = 'AI',
  onRematch,
  onMenu,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-violet-950/55 px-5">
        <View
          className="w-full max-w-md rounded-3xl border-4 border-amber-400 bg-fuchsia-50 p-6"
          style={theme.shadow.card}
        >
          <Text className="mb-2 text-center text-3xl font-black text-fuchsia-700">{title}</Text>
          <View className="mb-6 flex-row items-center justify-center gap-6">
            <View className="items-center">
              <Text className="text-xs font-black uppercase text-violet-600">{labelP1}</Text>
              <Text className="text-4xl font-black text-violet-950">{Math.round(scoreP1)}</Text>
            </View>
            <Text className="text-2xl font-black text-fuchsia-400">—</Text>
            <View className="items-center">
              <Text className="text-xs font-black uppercase text-violet-600">{labelP2}</Text>
              <Text className="text-4xl font-black text-violet-950">{Math.round(scoreP2)}</Text>
            </View>
          </View>
          <AppButton title="Rematch" onPress={onRematch} />
          <AppButton className="mt-3" title="Mini-games" variant="secondary" onPress={onMenu} />
        </View>
      </View>
    </Modal>
  );
}
