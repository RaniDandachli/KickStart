import { Modal, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import type { MatchOpponentPreview } from '@/store/matchmakingStore';

export function OpponentFoundModal({
  visible,
  opponent,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  opponent: MatchOpponentPreview | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View className="flex-1 items-center justify-center bg-black/70 px-6">
        <Card className="w-full max-w-md border-neon-lime/40">
          <Text className="mb-1 text-xs uppercase text-neon-lime">Match found</Text>
          <Text className="text-2xl font-black text-white">Ready to clash?</Text>
          {opponent ? (
            <View className="my-4 rounded-xl bg-ink-900/80 p-3">
              <Text className="text-lg font-bold text-white">{opponent.username}</Text>
              <Text className="text-sm text-white/60">
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
