import { Modal, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import type { MatchOpponentPreview } from '@/store/matchmakingStore';

export function OpponentFoundModal({
  visible,
  opponent,
  prizeUsd,
  freeCasual,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  opponent: MatchOpponentPreview | null;
  /** Listed fixed reward for fee-paid skill contests (optional). */
  prizeUsd?: number;
  /** No fee / no cash prize — casual pairing only. */
  freeCasual?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View className="flex-1 items-center justify-center bg-slate-900/35 px-6">
        <Card className="w-full max-w-md border-emerald-200">
          <Text className="mb-1 text-xs uppercase text-emerald-600">Match found</Text>
          <Text className="text-2xl font-black text-slate-900">Ready to clash?</Text>
          {freeCasual ? (
            <Text className="mt-2 text-center text-sm font-bold text-slate-700">No entry fee · no cash prize</Text>
          ) : prizeUsd != null ? (
            <View className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50/90 px-3 py-2">
              <Text className="text-center text-[10px] font-extrabold uppercase tracking-wide text-amber-900/80">
                Top performer prize
              </Text>
              <Text className="text-center text-lg font-black text-amber-950">${prizeUsd}</Text>
              <Text className="mt-1 text-center text-[10px] font-semibold text-amber-900/70">
                Best score wins · Run It–listed amount
              </Text>
              <Text className="mt-2 text-center text-[10px] font-semibold text-amber-900/65">
                Not top score? You&apos;ll earn Arcade Credits for the Arcade floor (gameplay only — not cash).
              </Text>
            </View>
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
