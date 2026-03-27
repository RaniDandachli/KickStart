import { Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { useTransactions } from '@/hooks/useTransactions';
import { useAuthStore } from '@/store/authStore';
import type { TransactionKind } from '@/types/database';

export default function TransactionsScreen() {
  const uid = useAuthStore((s) => s.user?.id);
  const q = useTransactions(uid);

  return (
    <Screen>
      <Text className="mb-2 text-2xl font-bold text-white">Rewards ledger</Text>
      <Text className="mb-4 text-sm text-white/60">
        Credits, gems, cosmetics, subscriptions — no withdrawals or cash wallet.
      </Text>
      {q.isLoading && (
        <>
          <SkeletonBlock className="mb-2 h-14" />
          <SkeletonBlock className="mb-2 h-14" />
        </>
      )}
      {q.error && <EmptyState title="Could not load ledger" description={(q.error as Error).message} />}
      {q.data?.map((t) => (
        <Card key={t.id} className="mb-2">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text className="font-semibold text-white">{t.description}</Text>
              <Text className="text-xs text-white/40">{new Date(t.created_at).toLocaleString()}</Text>
            </View>
            <Badge label={`${t.amount >= 0 ? '+' : ''}${t.amount} ${t.currency}`} tone={toneFor(t.kind)} />
          </View>
        </Card>
      ))}
      {!q.isLoading && !q.data?.length ? (
        <EmptyState title="No transactions yet" description="Complete matches or buy cosmetics." />
      ) : null}
    </Screen>
  );
}

function toneFor(k: TransactionKind): 'success' | 'warning' | 'neon' | 'default' {
  if (k === 'credit_earn' || k === 'gem_earn' || k === 'reward_grant') return 'success';
  if (k === 'subscription_event') return 'neon';
  if (k === 'cosmetic_purchase' || k === 'credit_spend' || k === 'gem_spend') return 'warning';
  return 'default';
}
