import { Modal, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import type { MatchOpponentPreview } from '@/store/matchmakingStore';

export function OpponentFoundModal({
  visible,
  opponent,
  prizeUsd,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  opponent: MatchOpponentPreview | null;
  /** Listed fixed reward for fee-paid skill contests (optional). */
  prizeUsd?: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View className="flex-1 items-center justify-center bg-slate-900/35 px-6">
        <Card className="w-full max-w-md border-emerald-200">
          <Text className="mb-1 text-xs uppercase text-emerald-600">Match found</Text>
          <Text className="text-2xl font-black text-slate-900">Ready to clash?</Text>
          {prizeUsd != null ? (
            <Text className="mt-2 text-center text-sm font-bold text-emerald-700">Prize ${prizeUsd} (top score)</Text>
          ) : null}
          {opponent ? (
            <View className="my-4 rounded-xl bg-slate-50 p-3">
              <Text className="text-lg font-bold text-slate-900">{opponent.username}</Text>
              <Text className="text-sm text-slate-600">
                Rating {opponent.rating} · {opponent.region}
              </Text>
            </View>
          ) : null}
          <View className="flex-row gap-2">
            <AppButton title="Decline" variant="ghost" className="flex-1" onPress={onDecline} />
            <AppButton title="Accept" className="flex-1" onPress={onAccept} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
