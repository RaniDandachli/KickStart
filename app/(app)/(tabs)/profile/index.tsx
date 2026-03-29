import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/AppButton';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { arcade } from '@/lib/arcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';
import { getSupabase } from '@/supabase/client';

/** Credits stored as cents (100 = $1.00). Change divisor if your API uses 1 credit = $1. */
const CREDITS_PER_DOLLAR = 100;

function formatUsdFromCredits(credits: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(credits / CREDITS_PER_DOLLAR);
}

const mockBadges = [
  { id: '1', name: 'Streak Starter', earned: true },
  { id: '2', name: 'Cosmetic Collector', earned: false },
];

const mockHistory = [
  { id: 'h1', label: 'Win vs NeoStriker', when: 'Yesterday' },
  { id: 'h2', label: 'Loss vs GoalRush', when: '2d ago' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const { data: profile, isLoading } = useProfile(uid);

  async function signOut() {
    if (ENABLE_BACKEND) {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    }
    useAuthStore.getState().signOutLocal();
    router.replace(ENABLE_BACKEND ? '/(auth)/sign-in' : '/(app)/(tabs)');
  }

  return (
    <Screen>
      <View className="mb-4 flex-row items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-amber-400/60 bg-slate-900/50">
          <Text className="text-2xl">🧤</Text>
        </View>
        <View className="flex-1">
          {isLoading ? (
            <SkeletonBlock className="h-6 w-40" />
          ) : (
            <>
              <Text className="text-2xl font-black text-white">{profile?.username ?? 'Player'}</Text>
              <Text className="text-sm text-slate-400">{profile?.display_name}</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {profile?.role && profile.role !== 'user' ? (
                  <Badge label={profile.role} tone="warning" />
                ) : null}
                {profile?.suspended_until ? <Badge label="Suspended" tone="danger" /> : null}
                {profile?.cheating_review_flag ? <Badge label="Review" tone="warning" /> : null}
              </View>
            </>
          )}
        </View>
      </View>

      {isLoading ? (
        <SkeletonBlock className="mb-4 h-36 w-full rounded-2xl" />
      ) : (
        <View style={styles.walletOuter}>
          <LinearGradient colors={['#0c1829', '#132948', '#0a1628']} style={styles.walletInner}>
            <View style={styles.walletTitleRow}>
              <Ionicons name="wallet" size={22} color={arcade.gold} />
              <Text style={styles.walletTitle}>Wallet</Text>
            </View>
            <Text style={styles.walletBalance}>{formatUsdFromCredits(profile?.credits ?? 0)}</Text>
            <Text style={styles.walletSub}>Available to play & withdraw</Text>
            <View style={styles.walletRow}>
              <View style={[styles.walletPill, styles.walletPillLeft]}>
                <Text style={styles.walletPillLabel}>Credits</Text>
                <Text style={styles.walletPillVal}>{(profile?.credits ?? 0).toLocaleString()}</Text>
              </View>
              <View style={styles.walletPill}>
                <Text style={styles.walletPillLabel}>Gems</Text>
                <Text style={styles.walletPillVal}>{(profile?.gems ?? 0).toLocaleString()}</Text>
              </View>
            </View>
            <Text style={styles.walletHint}>
              Credits pay for entries and arcade games. Withdraw this balance when payouts are enabled (same pool).
            </Text>
            <View style={styles.walletActions}>
              <Pressable style={[styles.walletBtn, styles.walletBtnPrimary]} onPress={() => router.push('/(app)/(tabs)/play')}>
                <Ionicons name="game-controller-outline" size={18} color={arcade.navy0} />
                <Text style={styles.walletBtnText}>Play</Text>
              </Pressable>
              <Pressable
                style={[styles.walletBtn, styles.walletBtnGhost]}
                onPress={() => router.push('/(app)/(tabs)/profile/transactions')}
              >
                <Ionicons name="arrow-down-circle-outline" size={18} color={arcade.gold} />
                <Text style={styles.walletBtnTextGhost}>Withdraw</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      )}

      <Card className="mb-4">
        <Text className="mb-2 font-black text-slate-900">Stats</Text>
        <Text className="text-sm text-slate-600">Hydrate from `user_stats` + `ratings` after sync.</Text>
      </Card>

      <Text className="mb-2 text-lg font-black text-amber-300">Match history</Text>
      {mockHistory.map((h) => (
        <View
          key={h.id}
          className="mb-2 rounded-xl border border-amber-400/30 bg-slate-950/50 px-3 py-2"
        >
          <Text className="font-semibold text-slate-100">{h.label}</Text>
          <Text className="text-xs text-slate-400">{h.when}</Text>
        </View>
      ))}

      <Text className="mb-2 mt-4 text-lg font-black text-amber-300">Achievements</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {mockBadges.map((b) => (
          <Badge key={b.id} label={b.name} tone={b.earned ? 'success' : 'default'} />
        ))}
      </View>

      <Card className="mb-4">
        <Text className="font-semibold text-slate-900">Owned cosmetics</Text>
        <Text className="mt-1 text-sm text-slate-600">TODO: query `user_cosmetics` join `cosmetics`.</Text>
      </Card>

      <Card className="mb-4">
        <Text className="font-semibold text-slate-900">Run it Plus</Text>
        <Text className="mt-1 text-sm text-slate-600">
          Subscription placeholder — Stripe scaffold via Edge `syncSubscriptionStatus`.
        </Text>
      </Card>

      <AppButton title="Settings" variant="secondary" onPress={() => router.push('/(app)/(tabs)/profile/settings')} />
      <AppButton
        className="mt-2"
        title="Transaction history"
        variant="ghost"
        onPress={() => router.push('/(app)/(tabs)/profile/transactions')}
      />
      <AppButton className="mt-2" title="Sign out" variant="danger" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  walletOuter: {
    borderRadius: 18,
    padding: 2,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(212, 165, 116, 0.85)',
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  walletInner: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  walletTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  walletTitle: {
    marginLeft: 8,
    color: arcade.white,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  walletBalance: { color: arcade.gold, fontSize: 36, fontWeight: '900', marginTop: 4 },
  walletSub: {
    color: arcade.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 12,
  },
  walletRow: { flexDirection: 'row' },
  walletPill: {
    flex: 1,
    backgroundColor: 'rgba(6, 13, 24, 0.65)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  walletPillLeft: { marginRight: 10 },
  walletPillLabel: {
    color: arcade.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  walletPillVal: { color: arcade.white, fontSize: 18, fontWeight: '900' },
  walletHint: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    marginBottom: 14,
  },
  walletActions: { flexDirection: 'row' },
  walletBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  walletBtnPrimary: {
    backgroundColor: arcade.gold,
    borderWidth: 2,
    borderColor: '#FDE68A',
    marginRight: 10,
  },
  walletBtnText: { marginLeft: 8, color: arcade.navy0, fontWeight: '900', fontSize: 15 },
  walletBtnGhost: { borderWidth: 2, borderColor: arcade.goldBorder },
  walletBtnTextGhost: { marginLeft: 8, color: arcade.gold, fontWeight: '800', fontSize: 15 },
});
