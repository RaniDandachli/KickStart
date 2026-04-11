import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND, WALLET_TOPUP_STRIPE_ENABLED } from '@/constants/featureFlags';
import { useWalletPaymentSheet } from '@/hooks/useWalletPaymentSheet';
import { useProfile } from '@/hooks/useProfile';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { CREDIT_PACKAGES } from '@/lib/creditPackages';
import { CASH_TOPUP_REQUIRES_CONNECT } from '@/lib/payoutCopy';
import { ROUTES, safeBack } from '@/lib/appNavigation';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan } from '@/lib/runitArcadeTheme';
import {
  assertValidTopUpAmountCents,
  completeCreditsPackagePurchase,
  completeWalletTopUp,
} from '@/services/wallet/completeTopUp';
import {
  fetchStripeConnectStatus,
  type StripeConnectStatus,
} from '@/services/wallet/stripeConnectOnboarding';
import { useAuthStore } from '@/store/authStore';

function goBackFromAddFunds(router: ReturnType<typeof useRouter>) {
  safeBack(router, ROUTES.profileTab);
}

/** Embedded Stripe Payment Sheet — only mount when `StripeProvider` is present (publishable key in .env). */
function WalletPaySheetButton({
  amountCents,
  onComplete,
}: {
  amountCents: number;
  onComplete: (completed: boolean) => void;
}) {
  const { payWallet } = useWalletPaymentSheet();
  const [pending, setPending] = useState(false);
  return (
    <Pressable
      onPress={() => {
        void (async () => {
          setPending(true);
          try {
            const ok = await payWallet(amountCents);
            onComplete(ok);
          } catch (e) {
            Alert.alert('Add funds', e instanceof Error ? e.message : 'Payment failed');
          } finally {
            setPending(false);
          }
        })();
      }}
      disabled={pending}
      style={({ pressed }) => [styles.ctaOuter, pressed && !pending && { opacity: 0.92 }]}
    >
      <LinearGradient colors={['#ff006e', '#9d4edd']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
        {pending ? <ActivityIndicator color="#fff" /> : (
          <>
            <SafeIonicons name="card-outline" size={22} color="#fff" />
            <Text style={styles.ctaTxt}>Pay in app</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function CreditsPaySheetButton({
  packageId,
  payLabel,
  onComplete,
}: {
  packageId: string;
  payLabel: string;
  onComplete: (completed: boolean) => void;
}) {
  const { payCredits } = useWalletPaymentSheet();
  const [pending, setPending] = useState(false);
  return (
    <Pressable
      onPress={() => {
        void (async () => {
          setPending(true);
          try {
            const ok = await payCredits(packageId);
            onComplete(ok);
          } catch (e) {
            Alert.alert('Credits', e instanceof Error ? e.message : 'Payment failed');
          } finally {
            setPending(false);
          }
        })();
      }}
      disabled={pending}
      style={({ pressed }) => [styles.ctaOuter, pressed && !pending && { opacity: 0.92 }]}
    >
      <LinearGradient colors={['#ff006e', '#9d4edd']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
        {pending ? <ActivityIndicator color="#fff" /> : (
          <>
            <SafeIonicons name="cart-outline" size={22} color="#fff" />
            <Text style={styles.ctaTxt}>{payLabel}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const PRESETS_CENTS = [500, 1000, 2500, 5000] as const;

type Step = 'amount' | 'payment';
type ShopTab = 'wallet' | 'credits';

export default function AddFundsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const walletCents = useWalletDisplayCents();
  const prizeCredits = usePrizeCreditsDisplay();

  const [shopTab, setShopTab] = useState<ShopTab>('wallet');
  const [step, setStep] = useState<Step>('amount');
  const [selectedCents, setSelectedCents] = useState<number>(1000);
  const [customDollars, setCustomDollars] = useState('');
  const [selectedPackId, setSelectedPackId] = useState<string>(CREDIT_PACKAGES[1]?.id ?? CREDIT_PACKAGES[0]?.id ?? '');
  const [connectStatus, setConnectStatus] = useState<StripeConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  const loadConnectStatus = useCallback(async () => {
    if (!ENABLE_BACKEND || !WALLET_TOPUP_STRIPE_ENABLED || !uid) {
      setConnectStatus(null);
      return;
    }
    setConnectLoading(true);
    try {
      const s = await fetchStripeConnectStatus();
      setConnectStatus(s);
    } finally {
      setConnectLoading(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void loadConnectStatus();
    }, [loadConnectStatus]),
  );

  const amountCents = useMemo(() => {
    if (customDollars.trim() !== '') {
      const n = Number.parseFloat(customDollars.replace(/[^0-9.]/g, ''));
      if (!Number.isFinite(n) || n <= 0) return selectedCents;
      return Math.round(n * 100);
    }
    return selectedCents;
  }, [customDollars, selectedCents]);

  const selectedPack = useMemo(
    () => CREDIT_PACKAGES.find((p) => p.id === selectedPackId) ?? CREDIT_PACKAGES[0],
    [selectedPackId],
  );

  const stripeReady = ENABLE_BACKEND && WALLET_TOPUP_STRIPE_ENABLED;
  const backendPending = ENABLE_BACKEND && !WALLET_TOPUP_STRIPE_ENABLED;
  const stripePk = env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const useEmbeddedSheet = stripeReady && Platform.OS !== 'web' && !!stripePk;

  /** Cash wallet top-up requires the same Stripe Connect payout profile as withdrawals. */
  const walletTopUpBlocked =
    stripeReady &&
    !!uid &&
    (connectLoading || connectStatus === null || connectStatus.payouts_enabled !== true);

  const handleWalletPaid = useCallback(
    (completed: boolean) => {
      if (completed && ENABLE_BACKEND && uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      if (completed) {
        Alert.alert(
          'Payment',
          stripeReady
            ? 'Thanks! Your cash balance updates within a few seconds after Stripe confirms the payment.'
            : `${formatUsdFromCents(amountCents)} added to your wallet.`,
          [{ text: 'OK', onPress: () => goBackFromAddFunds(router) }],
        );
      }
    },
    [amountCents, qc, router, stripeReady, uid],
  );

  const handleCreditsPaid = useCallback(
    (completed: boolean) => {
      if (completed && ENABLE_BACKEND && uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      if (completed) {
        Alert.alert(
          'Payment',
          stripeReady
            ? 'Thanks! Arcade credits appear shortly after Stripe confirms the payment.'
            : 'Arcade Credits updated on this device.',
          [{ text: 'OK', onPress: () => goBackFromAddFunds(router) }],
        );
      }
    },
    [qc, router, stripeReady, uid],
  );

  const topUpWallet = useMutation({
    mutationFn: async () => completeWalletTopUp(amountCents),
    onSuccess: handleWalletPaid,
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Could not add funds';
      Alert.alert('Add funds', msg);
    },
  });

  const buyCredits = useMutation({
    mutationFn: async () => completeCreditsPackagePurchase(selectedPackId),
    onSuccess: handleCreditsPaid,
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Could not complete purchase';
      Alert.alert('Credits', msg);
    },
  });

  const onContinueToPayment = useCallback(() => {
    if (walletTopUpBlocked) {
      Alert.alert('Connect payouts first', CASH_TOPUP_REQUIRES_CONNECT, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Set up bank', onPress: () => router.push('/(app)/(tabs)/profile/stripe-connect') },
      ]);
      return;
    }
    try {
      assertValidTopUpAmountCents(amountCents);
    } catch (e) {
      Alert.alert('Amount', e instanceof Error ? e.message : 'Invalid amount');
      return;
    }
    setStep('payment');
  }, [amountCents, router, walletTopUpBlocked]);

  const onPayWallet = useCallback(() => {
    topUpWallet.mutate();
  }, [topUpWallet]);

  const onPayCredits = useCallback(() => {
    if (!selectedPackId) {
      Alert.alert('Credits', 'Choose a package.');
      return;
    }
    buyCredits.mutate();
  }, [buyCredits, selectedPackId]);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (shopTab === 'wallet' && step === 'payment') setStep('amount');
            else goBackFromAddFunds(router);
          }}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <SafeIonicons name="chevron-back" size={24} color={runit.neonCyan} />
          <Text style={styles.backLbl}>{shopTab === 'wallet' && step === 'payment' ? 'Amount' : 'Back'}</Text>
        </Pressable>
        <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowCyan]}>SHOP</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.tabs}>
          <Pressable
            onPress={() => {
              setShopTab('wallet');
              setStep('amount');
            }}
            style={[styles.tab, shopTab === 'wallet' && styles.tabOn]}
          >
            <Text style={[styles.tabTxt, shopTab === 'wallet' && styles.tabTxtOn]}>Cash wallet</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShopTab('credits');
              setStep('amount');
            }}
            style={[styles.tab, shopTab === 'credits' && styles.tabOn]}
          >
            <Text style={[styles.tabTxt, shopTab === 'credits' && styles.tabTxtOn]}>Arcade credits</Text>
          </Pressable>
        </View>

        <LinearGradient colors={[runit.neonPurple, runit.neonPink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.balanceOuter, runitGlowPinkSoft]}>
          <View style={styles.balanceInner}>
            <Text style={styles.balanceLbl}>Cash balance</Text>
            <Text style={styles.balanceVal}>{formatUsdFromCents(walletCents)}</Text>
            <Text style={styles.balanceLbl}>Arcade credits</Text>
            <Text style={[styles.balanceVal, styles.balanceCredits]}>{prizeCredits.toLocaleString()}</Text>
            {profileQ.isLoading ? null : (
              <Text style={styles.balanceMeta}>
                {ENABLE_BACKEND
                  ? 'Cash is for contest access & tournaments. Arcade Credits are for arcade runs.'
                  : 'Guest mode: balances stay on this device. Sign in with Supabase + Stripe for cloud wallet & card top-ups.'}
              </Text>
            )}
          </View>
        </LinearGradient>

        {backendPending ? (
          <View style={styles.banner}>
            <SafeIonicons name="information-circle" size={20} color="#FDE047" />
            <Text style={styles.bannerTxt}>
              Stripe on the server is separate from this app build: add EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED=true to your project
              root .env (exactly true, no spaces), then stop Expo and run npx expo start --clear. Supabase secrets alone do not enable
              payments in the app.
            </Text>
          </View>
        ) : null}

        {stripeReady && Platform.OS !== 'web' && !stripePk ? (
          <View style={styles.banner}>
            <SafeIonicons name="information-circle" size={20} color="#93c5fd" />
            <Text style={styles.bannerTxt}>
              Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_… or pk_live_…) to .env for in-app card entry. Without it, this screen uses
              Stripe in the browser instead.
            </Text>
          </View>
        ) : null}

        {shopTab === 'wallet' ? (
          stripeReady && uid && walletTopUpBlocked ? (
            <View style={styles.payoutGate}>
              {connectLoading ? (
                <View style={styles.payoutGateLoading}>
                  <ActivityIndicator color={runit.neonCyan} size="small" />
                  <Text style={styles.payoutGateLoadingTxt}>Checking payout setup…</Text>
                </View>
              ) : null}
              <Text style={styles.payoutGateTitle}>Connect your bank to add cash</Text>
              <Text style={styles.payoutGateBody}>{CASH_TOPUP_REQUIRES_CONNECT}</Text>
              <Pressable
                onPress={() => router.push('/(app)/(tabs)/profile/stripe-connect')}
                style={({ pressed }) => [styles.payoutGateCta, pressed && { opacity: 0.9 }]}
              >
                <LinearGradient colors={['#0369a1', '#0ea5e9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.payoutGateCtaGrad}>
                  <SafeIonicons name="wallet-outline" size={20} color="#fff" />
                  <Text style={styles.payoutGateCtaTxt}>Set up payouts</Text>
                </LinearGradient>
              </Pressable>
              {!connectLoading && connectStatus === null ? (
                <Pressable onPress={() => void loadConnectStatus()} style={styles.retryLink}>
                  <Text style={styles.retryLinkTxt}>Tap to retry connection check</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
          <>
            {step === 'amount' ? (
              <>
                <Text style={styles.sectionLbl}>Amount (USD)</Text>
                <View style={styles.presets}>
                  {PRESETS_CENTS.map((c) => {
                    const active = customDollars.trim() === '' && selectedCents === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => {
                          setCustomDollars('');
                          setSelectedCents(c);
                        }}
                        style={({ pressed }) => [styles.preset, active && styles.presetOn, pressed && { opacity: 0.88 }]}
                      >
                        <Text style={[styles.presetTxt, active && styles.presetTxtOn]}>{formatUsdFromCents(c)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.customLbl}>Or enter amount</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$0.00"
                  placeholderTextColor="rgba(148,163,184,0.45)"
                  keyboardType="decimal-pad"
                  value={customDollars}
                  onChangeText={setCustomDollars}
                />
                <Text style={styles.hint}>
                  {useEmbeddedSheet
                    ? 'You will pay with Stripe’s in-app sheet (Apple Pay / Google Pay / card).'
                    : 'You will pay with Stripe (hosted checkout in the browser on web, or in-app when publishable key is set).'}
                </Text>
                <Pressable onPress={() => void onContinueToPayment()} style={({ pressed }) => [styles.ctaOuter, pressed && { opacity: 0.92 }]}>
                  <LinearGradient colors={['#0369a1', '#0ea5e9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
                    <Text style={styles.ctaTxt}>Continue to payment</Text>
                    <SafeIonicons name="arrow-forward" size={20} color="#fff" />
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.payHead}>Payment</Text>
                <Text style={styles.paySub}>Adding {formatUsdFromCents(amountCents)} to your cash wallet</Text>
                {stripeReady ? (
                  <Text style={styles.stripeNote}>
                    {useEmbeddedSheet
                      ? 'Stripe opens a secure payment sheet inside the app.'
                      : 'A secure Stripe page opens in the browser. When you finish, you return here automatically.'}
                  </Text>
                ) : (
                  <Text style={styles.stripeNote}>
                    {ENABLE_BACKEND
                      ? 'Stripe checkout is not enabled in this build — enable wallet top-up in project env to take card payments.'
                      : 'Guest mode — adds cash on this device only (no payment processor).'}
                  </Text>
                )}
                {useEmbeddedSheet ? (
                  <WalletPaySheetButton amountCents={amountCents} onComplete={handleWalletPaid} />
                ) : (
                  <Pressable
                    onPress={onPayWallet}
                    disabled={topUpWallet.isPending}
                    style={({ pressed }) => [styles.ctaOuter, pressed && !topUpWallet.isPending && { opacity: 0.92 }]}
                  >
                    <LinearGradient colors={['#ff006e', '#9d4edd']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
                      {topUpWallet.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <SafeIonicons name="card-outline" size={22} color="#fff" />
                          <Text style={styles.ctaTxt}>{stripeReady ? 'Pay with Stripe' : 'Add cash (device)'}</Text>
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                )}
              </>
            )}
          </>
          )
        ) : (
          <>
            <Text style={styles.sectionLbl}>Credit packs</Text>
            <Text style={styles.hint}>Tap a pack to select it — your choice is highlighted.</Text>
            <View style={styles.packGrid}>
              {CREDIT_PACKAGES.map((p) => {
                const active = selectedPackId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedPackId(p.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${p.label}, ${p.prizeCredits} credits, ${formatUsdFromCents(p.priceCents)}${active ? ', selected' : ''}`}
                    style={({ pressed }) => [styles.pack, active && styles.packOn, pressed && { opacity: 0.92 }]}
                  >
                    {p.tag ? (
                      <Text style={[styles.packTag, active && styles.packTagOn]}>{p.tag}</Text>
                    ) : null}
                    <View style={styles.packTopRow}>
                      <Text style={[styles.packLabel, active && styles.packLabelOn]}>{p.label}</Text>
                      {active ? (
                        <SafeIonicons name="checkmark-circle" size={22} color={runit.neonCyan} />
                      ) : (
                        <View style={styles.packCheckPlaceholder} />
                      )}
                    </View>
                    <Text style={[styles.packCredits, active && styles.packCreditsOn]}>
                      {p.prizeCredits.toLocaleString()} credits
                    </Text>
                    <Text style={[styles.packPrice, active && styles.packPriceOn]}>{formatUsdFromCents(p.priceCents)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.selectionSummary}>
              <Text style={styles.selectionSummaryLbl}>Your selection</Text>
              <Text style={styles.selectionSummaryTitle}>{selectedPack.label}</Text>
              <Text style={styles.selectionSummaryMeta}>
                {selectedPack.prizeCredits.toLocaleString()} credits · {formatUsdFromCents(selectedPack.priceCents)}
              </Text>
            </View>

            {useEmbeddedSheet ? (
              <CreditsPaySheetButton
                packageId={selectedPackId}
                payLabel={`Pay ${formatUsdFromCents(selectedPack.priceCents)}`}
                onComplete={handleCreditsPaid}
              />
            ) : (
              <Pressable
                onPress={onPayCredits}
                disabled={buyCredits.isPending}
                style={({ pressed }) => [styles.ctaOuter, pressed && !buyCredits.isPending && { opacity: 0.92 }]}
              >
                <LinearGradient colors={['#ff006e', '#9d4edd']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
                  {buyCredits.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <SafeIonicons name="cart-outline" size={22} color="#fff" />
                      <Text style={styles.ctaTxt}>
                        {stripeReady ? `Pay ${formatUsdFromCents(selectedPack.priceCents)}` : 'Add credits (device)'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            )}
          </>
        )}

        {ENABLE_BACKEND && stripeReady ? (
          <Pressable onPress={() => router.push('/(app)/(tabs)/profile/stripe-connect')} style={styles.linkRow}>
            <SafeIonicons name="link-outline" size={18} color={runit.neonCyan} />
            <Text style={styles.linkTxt}>Creator payouts — Stripe Connect</Text>
            <SafeIonicons name="chevron-forward" size={18} color="rgba(148,163,184,0.8)" />
          </Pressable>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backLbl: { color: runit.neonCyan, fontWeight: '800', fontSize: 15 },
  title: { color: '#fff', fontSize: 16, letterSpacing: 2 },
  topSpacer: { width: 72 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(157,78,237,0.45)',
    backgroundColor: 'rgba(8,4,18,0.65)',
    alignItems: 'center',
  },
  tabOn: { borderColor: runit.neonCyan, backgroundColor: 'rgba(0,240,255,0.08)' },
  tabTxt: { color: '#94a3b8', fontWeight: '800', fontSize: 13 },
  tabTxtOn: { color: runit.neonCyan },
  balanceOuter: { borderRadius: 16, padding: 2, marginBottom: 22 },
  balanceInner: {
    borderRadius: 14,
    backgroundColor: 'rgba(6,2,14,0.78)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  balanceLbl: { color: 'rgba(148,163,184,0.9)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  balanceVal: { color: runit.neonCyan, fontSize: 26, fontWeight: '900', marginTop: 2 },
  balanceCredits: { color: '#f472b6', marginBottom: 4 },
  balanceMeta: { color: 'rgba(148,163,184,0.8)', fontSize: 12, marginTop: 6 },
  sectionLbl: { color: 'rgba(226,232,240,0.95)', fontWeight: '800', fontSize: 13, marginBottom: 10 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  preset: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(157,78,237,0.45)',
    backgroundColor: 'rgba(8,4,18,0.65)',
  },
  presetOn: { borderColor: runit.neonCyan, backgroundColor: 'rgba(0,240,255,0.08)' },
  presetTxt: { color: '#e2e8f0', fontWeight: '800', fontSize: 15 },
  presetTxtOn: { color: runit.neonCyan },
  customLbl: { color: 'rgba(148,163,184,0.9)', fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.45)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: 'rgba(8,4,18,0.75)',
    marginBottom: 12,
  },
  hint: { color: 'rgba(148,163,184,0.75)', fontSize: 12, lineHeight: 17, marginBottom: 18 },
  ctaOuter: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  ctaTxt: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  payHead: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 4 },
  paySub: { color: 'rgba(148,163,184,0.9)', fontSize: 14, marginBottom: 14 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(234,179,8,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.35)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bannerTxt: { flex: 1, color: 'rgba(254,243,199,0.95)', fontSize: 12, lineHeight: 17 },
  stripeNote: { color: 'rgba(148,163,184,0.85)', fontSize: 12, lineHeight: 17, marginBottom: 16 },
  packGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  pack: {
    width: '47%',
    minWidth: 140,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(157,78,237,0.45)',
    backgroundColor: 'rgba(8,4,18,0.72)',
  },
  packOn: {
    borderColor: runit.neonCyan,
    borderWidth: 3,
    backgroundColor: 'rgba(0,240,255,0.16)',
    shadowColor: runit.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  packTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },
  packCheckPlaceholder: { width: 22, height: 22 },
  packTag: { color: '#fbbf24', fontSize: 10, fontWeight: '900', marginBottom: 4 },
  packTagOn: { color: '#fde68a' },
  packLabel: { color: '#fff', fontWeight: '900', fontSize: 16, flex: 1 },
  packLabelOn: { color: runit.neonCyan },
  packCredits: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginBottom: 6 },
  packCreditsOn: { color: 'rgba(226,232,240,0.98)' },
  packPrice: { color: runit.neonCyan, fontWeight: '900', fontSize: 15 },
  packPriceOn: { color: '#fff', fontSize: 16 },
  selectionSummary: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.4)',
    backgroundColor: 'rgba(0,240,255,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  selectionSummaryLbl: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  selectionSummaryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  selectionSummaryMeta: {
    color: runit.neonCyan,
    fontSize: 15,
    fontWeight: '800',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.2)',
  },
  linkTxt: { flex: 1, color: runit.neonCyan, fontWeight: '700', fontSize: 14 },
  payoutGate: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    backgroundColor: 'rgba(120,53,15,0.2)',
    padding: 16,
    marginBottom: 8,
  },
  payoutGateLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  payoutGateLoadingTxt: { color: 'rgba(226,232,240,0.9)', fontSize: 13, fontWeight: '600' },
  payoutGateTitle: { color: '#fff', fontSize: 17, fontWeight: '900', marginBottom: 8 },
  payoutGateBody: { color: 'rgba(226,232,240,0.92)', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  payoutGateCta: { borderRadius: 14, overflow: 'hidden' },
  payoutGateCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  payoutGateCtaTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  retryLink: { marginTop: 12, alignItems: 'center' },
  retryLinkTxt: { color: runit.neonCyan, fontSize: 13, fontWeight: '700' },
});
