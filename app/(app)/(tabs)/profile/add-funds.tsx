import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { WhopCheckoutHost } from '@/components/wallet/WhopCheckoutHost';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND, WALLET_TOPUP_STRIPE_ENABLED, WHOP_CHECKOUT_ENABLED } from '@/constants/featureFlags';
import { useWalletPaymentSheet } from '@/hooks/useWalletPaymentSheet';
import { useProfile } from '@/hooks/useProfile';
import { useProfileFightStats } from '@/hooks/useProfileFightStats';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { CREDIT_PACKAGES } from '@/lib/creditPackages';
import { WALLET_DEPOSIT_WITHDRAW_POLICY } from '@/lib/payoutCopy';
import { ROUTES, safeBack } from '@/lib/appNavigation';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import { formatUsdFromCents } from '@/lib/money';
import {
  WALLET_DEPOSIT_FEE_PERCENT,
  WALLET_DEPOSIT_FIXED_FEE_CENTS,
  walletDepositProcessingFeeCents,
  walletDepositTotalChargeCents,
} from '@/lib/walletDepositFee';
import { runit, runitFont } from '@/lib/runitArcadeTheme';
import {
  assertValidTopUpAmountCents,
  completeCreditsPackagePurchase,
  completeWalletTopUp,
  type WalletCheckoutProvider,
} from '@/services/wallet/completeTopUp';
import { useAuthStore } from '@/store/authStore';

function goBackFromAddFunds(router: ReturnType<typeof useRouter>) {
  safeBack(router, ROUTES.profileTab);
}

/** Embedded Stripe Payment Sheet — only mount when `StripeProvider` is present (publishable key in .env). */
function WalletPaySheetButton({
  amountCents,
  payLabel,
  onComplete,
}: {
  amountCents: number;
  /** e.g. "Pay $10.59" — includes processing fee line */
  payLabel: string;
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
            <Text style={styles.ctaTxt}>{payLabel}</Text>
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

/** VAZA-inspired wallet shell: cyan headers, lime deposit CTA, teal panels (see design pass on Shop). */
const W = {
  cyan: '#22d3ee',
  cyanMuted: 'rgba(34,211,238,0.85)',
  lime: '#4ade80',
  limeGrad: ['#4ade80', '#22c55e'] as const,
  panel: 'rgba(15,23,42,0.92)',
  panelBorder: 'rgba(56,189,248,0.22)',
  statBlock: '#0e7490',
  statBlockBorder: 'rgba(34,211,238,0.35)',
};

export default function AddFundsScreen() {
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const { tab: tabFromRoute } = useLocalSearchParams<{ tab?: string }>();
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const fightQ = useProfileFightStats(uid);
  const walletCents = useWalletDisplayCents();
  const prizeCredits = usePrizeCreditsDisplay();
  const cardRow = winW >= 720;

  const [shopTab, setShopTab] = useState<ShopTab>('wallet');
  const [step, setStep] = useState<Step>('amount');
  const [selectedCents, setSelectedCents] = useState<number>(1000);
  const [customDollars, setCustomDollars] = useState('');
  const [selectedPackId, setSelectedPackId] = useState<string>(CREDIT_PACKAGES[1]?.id ?? CREDIT_PACKAGES[0]?.id ?? '');
  const [checkoutProvider, setCheckoutProvider] = useState<WalletCheckoutProvider>('stripe');

  useEffect(() => {
    if (tabFromRoute === 'credits') {
      setShopTab('credits');
      setStep('amount');
    } else if (tabFromRoute === 'wallet') {
      setShopTab('wallet');
      setStep('amount');
    }
  }, [tabFromRoute]);

  const stripeReady = ENABLE_BACKEND && WALLET_TOPUP_STRIPE_ENABLED;
  const whopReady = ENABLE_BACKEND && WHOP_CHECKOUT_ENABLED;
  const checkoutUnlocked = stripeReady || whopReady;

  useEffect(() => {
    if (whopReady && !stripeReady) setCheckoutProvider('whop');
    else if (stripeReady && !whopReady) setCheckoutProvider('stripe');
  }, [whopReady, stripeReady]);

  const amountCents = useMemo(() => {
    if (customDollars.trim() !== '') {
      const n = Number.parseFloat(customDollars.replace(/[^0-9.]/g, ''));
      if (!Number.isFinite(n) || n <= 0) return selectedCents;
      return Math.round(n * 100);
    }
    return selectedCents;
  }, [customDollars, selectedCents]);

  const walletFeeCents =
    shopTab === 'wallet' && ENABLE_BACKEND ? walletDepositProcessingFeeCents(amountCents) : 0;
  const walletTotalChargeCents =
    shopTab === 'wallet'
      ? ENABLE_BACKEND
        ? walletDepositTotalChargeCents(amountCents)
        : amountCents
      : amountCents;

  const selectedPack = useMemo(
    () => CREDIT_PACKAGES.find((p) => p.id === selectedPackId) ?? CREDIT_PACKAGES[0],
    [selectedPackId],
  );

  const backendPending = ENABLE_BACKEND && !checkoutUnlocked;
  const stripePk = env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const useEmbeddedSheet =
    stripeReady && checkoutProvider === 'stripe' && Platform.OS !== 'web' && !!stripePk;
  const payRailName = checkoutProvider === 'whop' ? 'Whop' : 'Stripe';

  const handleWalletPaid = useCallback(
    (completed: boolean) => {
      if (completed && ENABLE_BACKEND && uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      if (completed) {
        Alert.alert(
          'Payment',
          checkoutUnlocked
            ? `Thanks! Your cash balance updates within a few seconds after ${payRailName} confirms the payment.`
            : `${formatUsdFromCents(amountCents)} added to your wallet.`,
          [{ text: 'OK', onPress: () => goBackFromAddFunds(router) }],
        );
      }
    },
    [amountCents, checkoutUnlocked, payRailName, qc, router, uid],
  );

  const handleCreditsPaid = useCallback(
    (completed: boolean) => {
      if (completed && ENABLE_BACKEND && uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      if (completed) {
        Alert.alert(
          'Payment',
          checkoutUnlocked
            ? `Thanks! Arcade credits appear shortly after ${payRailName} confirms the payment.`
            : 'Arcade Credits updated on this device.',
          [{ text: 'OK', onPress: () => goBackFromAddFunds(router) }],
        );
      }
    },
    [checkoutUnlocked, payRailName, qc, router, uid],
  );

  const topUpWallet = useMutation({
    mutationFn: async () => completeWalletTopUp(amountCents, checkoutProvider),
    onSuccess: handleWalletPaid,
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Could not add funds';
      Alert.alert('Add funds', msg);
    },
  });

  const buyCredits = useMutation({
    mutationFn: async () => completeCreditsPackagePurchase(selectedPackId, checkoutProvider),
    onSuccess: handleCreditsPaid,
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Could not complete purchase';
      Alert.alert('Credits', msg);
    },
  });

  const onContinueToPayment = useCallback(() => {
    try {
      assertValidTopUpAmountCents(amountCents);
    } catch (e) {
      Alert.alert('Amount', e instanceof Error ? e.message : 'Invalid amount');
      return;
    }
    setStep('payment');
  }, [amountCents]);

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

  const wins = fightQ.data?.wins ?? 0;
  const losses = fightQ.data?.losses ?? 0;
  const played = wins + losses;
  const winRateStr =
    ENABLE_BACKEND && uid && played > 0 ? `${Math.round((100 * wins) / played)}%` : '—';
  const recordStr = ENABLE_BACKEND && uid && played > 0 ? `${wins}/${played}` : '—';

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
          <SafeIonicons name="chevron-back" size={24} color={W.cyan} />
          <Text style={styles.backLbl}>{shopTab === 'wallet' && step === 'payment' ? 'Amount' : 'Back'}</Text>
        </Pressable>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.pageInner}>
          <Text style={[styles.walletHeroTitle, { fontFamily: runitFont.black }]}>WALLET</Text>
          <Text style={styles.walletHeroSub}>MANAGE YOUR FUNDS AND TRANSACTIONS</Text>

          <View style={[styles.cardGrid, !cardRow && styles.cardGridStack]}>
            <View style={styles.vCard}>
              <View style={styles.vCardTop}>
                <Text style={styles.vCardLbl}>Available balance</Text>
                <SafeIonicons name="wallet-outline" size={18} color={W.cyan} />
              </View>
              <Text style={styles.vCardVal}>{formatUsdFromCents(walletCents)} USD</Text>
              <View style={styles.vCardActions}>
                <Pressable
                  onPress={() => {
                    setShopTab('wallet');
                    setStep('amount');
                  }}
                  style={({ pressed }) => [styles.btnDeposit, pressed && { opacity: 0.92 }]}
                >
                  <LinearGradient colors={W.limeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnDepositGrad}>
                    <Text style={styles.btnDepositTxt}>+ DEPOSIT</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (ENABLE_BACKEND) router.push('/(app)/(tabs)/profile/stripe-connect');
                    else Alert.alert('Withdraw', 'Sign in and connect a bank account to withdraw.');
                  }}
                  style={({ pressed }) => [styles.btnWithdraw, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.btnWithdrawTxt}>- WITHDRAW</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.vCard}>
              <View style={styles.vCardTop}>
                <Text style={styles.vCardLbl}>Arcade credits</Text>
                <SafeIonicons name="sparkles-outline" size={18} color={W.cyan} />
              </View>
              <Text style={styles.vCardVal}>{prizeCredits.toLocaleString()}</Text>
              <Text style={styles.vCardHint}>Prize runs & ticket economy</Text>
              <Pressable
                onPress={() => {
                  setShopTab('credits');
                  setStep('amount');
                }}
                style={({ pressed }) => [styles.btnGhostSm, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.btnGhostSmTxt}>Buy credits →</Text>
              </Pressable>
            </View>

            <View style={styles.vCard}>
              <View style={styles.vCardTop}>
                <Text style={styles.vCardLbl}>Match record</Text>
                <SafeIonicons name="trending-up-outline" size={18} color={W.cyan} />
              </View>
              <Text style={styles.vCardVal}>{winRateStr}</Text>
              <Text style={styles.vCardHint}>
                {recordStr === '—' ? 'Ranked H2H stats when you play' : `Record ${recordStr}`}
              </Text>
            </View>
          </View>

          <Text style={styles.statSectionLbl}>WALLET STATISTICS</Text>
          <View style={styles.statBlocksRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statBlockVal}>{formatUsdFromCents(walletCents)}</Text>
              <Text style={styles.statBlockCap}>Cash balance</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statBlockVal}>{winRateStr}</Text>
              <Text style={styles.statBlockCap}>
                {recordStr === '—' ? 'Win rate' : `Win rate (${recordStr})`}
              </Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statBlockVal}>—</Text>
              <Text style={styles.statBlockCap}>Total won (coming soon)</Text>
            </View>
          </View>

          {profileQ.isLoading ? null : (
            <Text style={styles.dashboardFoot}>
              {ENABLE_BACKEND
                ? 'Cash is for contests & tournaments. Arcade credits are for arcade prize runs.'
                : 'Guest mode: balances stay on this device until you sign in.'}
            </Text>
          )}
        </View>

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

        {backendPending ? (
          <View style={styles.banner}>
            <SafeIonicons name="information-circle" size={20} color="#FDE047" />
            <Text style={styles.bannerTxt}>
              In-app card top-ups aren&apos;t enabled in this build yet. You can still browse pricing; check back after an app update or
              contact support if you need to add cash.
            </Text>
          </View>
        ) : null}

        {checkoutProvider === 'stripe' && stripeReady && Platform.OS !== 'web' && !stripePk ? (
          <View style={styles.banner}>
            <SafeIonicons name="information-circle" size={20} color="#93c5fd" />
            <Text style={styles.bannerTxt}>
              Card entry inside the app isn&apos;t configured in this build. Use any on-screen web checkout option, or update the app when
              a new version is available.
            </Text>
          </View>
        ) : null}

        {shopTab === 'wallet' && checkoutUnlocked && uid ? (
          <View style={styles.policyBanner}>
            <SafeIonicons name="information-circle" size={20} color="#93c5fd" />
            <Text style={styles.bannerTxt}>{WALLET_DEPOSIT_WITHDRAW_POLICY}</Text>
          </View>
        ) : null}

        {shopTab === 'wallet' ? (
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
                {ENABLE_BACKEND ? (
                  <View style={styles.walletFeeCard}>
                    <Text style={styles.walletFeeTitle}>Why your total is a little higher than the deposit</Text>
                    <Text style={styles.walletFeeBody}>
                      The amount you pick is the cash that lands in your wallet for entry fees — dollar for dollar. Card networks charge
                      a small fee to run secure payments, so we add {(WALLET_DEPOSIT_FEE_PERCENT * 100).toFixed(1)}% +{' '}
                      {formatUsdFromCents(WALLET_DEPOSIT_FIXED_FEE_CENTS)} on top. That way your playable balance matches what you chose,
                      and the processing cost is covered transparently.
                    </Text>
                    <View style={styles.walletFeeRows}>
                      <View style={styles.walletFeeRow}>
                        <Text style={styles.walletFeeRowLbl}>Added to your cash wallet</Text>
                        <Text style={styles.walletFeeRowVal}>{formatUsdFromCents(amountCents)}</Text>
                      </View>
                      <View style={styles.walletFeeRow}>
                        <Text style={styles.walletFeeRowLbl}>Card processing</Text>
                        <Text style={styles.walletFeeRowVal}>{formatUsdFromCents(walletFeeCents)}</Text>
                      </View>
                      <View style={[styles.walletFeeRow, styles.walletFeeRowTotal]}>
                        <Text style={styles.walletFeeRowLblStrong}>You pay (total)</Text>
                        <Text style={styles.walletFeeRowValStrong}>{formatUsdFromCents(walletTotalChargeCents)}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.hint}>
                    Guest mode: we credit the full amount you choose on this device — no card processing in offline demo.
                  </Text>
                )}
                <Text style={styles.hint}>
                  {ENABLE_BACKEND && checkoutUnlocked
                    ? stripeReady && whopReady
                      ? 'Next: choose Stripe or Whop, then pay securely (in-app Stripe sheet or browser checkout).'
                      : useEmbeddedSheet
                        ? 'You will pay with Stripe’s in-app sheet (Apple Pay / Google Pay / card).'
                        : whopReady
                          ? 'You will pay through Whop (hosted checkout in the browser).'
                          : 'You will pay with Stripe (hosted checkout in the browser on web, or in-app when publishable key is set).'
                    : 'Guest mode: tap Continue to add demo cash on this device.'}
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
                <Text style={styles.paySub}>
                  {formatUsdFromCents(amountCents)} to your wallet · {formatUsdFromCents(walletFeeCents)} processing ·{' '}
                  <Text style={styles.paySubStrong}>{formatUsdFromCents(walletTotalChargeCents)} charged</Text>
                </Text>
                {stripeReady && whopReady ? (
                  <View style={styles.payMethodBlock}>
                    <Text style={styles.payMethodLbl}>Pay with</Text>
                    <View style={styles.payMethodRow}>
                      <Pressable
                        onPress={() => setCheckoutProvider('stripe')}
                        style={[styles.payPill, checkoutProvider === 'stripe' && styles.payPillOn]}
                      >
                        <Text style={[styles.payPillTxt, checkoutProvider === 'stripe' && styles.payPillTxtOn]}>Stripe</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setCheckoutProvider('whop')}
                        style={[styles.payPill, checkoutProvider === 'whop' && styles.payPillOn]}
                      >
                        <Text style={[styles.payPillTxt, checkoutProvider === 'whop' && styles.payPillTxtOn]}>Whop</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                {checkoutUnlocked ? (
                  checkoutProvider === 'whop' ? (
                    <Text style={styles.stripeNote}>
                      Whop opens a secure checkout in the browser. When you finish, you return here automatically.
                    </Text>
                  ) : (
                    <Text style={styles.stripeNote}>
                      {useEmbeddedSheet
                        ? 'Stripe opens a secure payment sheet inside the app.'
                        : 'A secure Stripe page opens in the browser. When you finish, you return here automatically.'}
                    </Text>
                  )
                ) : (
                  <Text style={styles.stripeNote}>
                    {ENABLE_BACKEND
                      ? 'Checkout is not enabled in this build — enable Stripe and/or Whop in project env.'
                      : 'Guest mode — adds cash on this device only (no payment processor).'}
                  </Text>
                )}
                {useEmbeddedSheet ? (
                  <WalletPaySheetButton
                    amountCents={amountCents}
                    payLabel={checkoutUnlocked ? `Pay ${formatUsdFromCents(walletTotalChargeCents)}` : 'Add cash (device)'}
                    onComplete={handleWalletPaid}
                  />
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
                          <Text style={styles.ctaTxt}>
                            {checkoutUnlocked ? `Pay ${formatUsdFromCents(walletTotalChargeCents)}` : 'Add cash (device)'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                )}
              </>
            )}
          </>
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

            {stripeReady && whopReady ? (
              <View style={styles.payMethodBlock}>
                <Text style={styles.payMethodLbl}>Pay with</Text>
                <View style={styles.payMethodRow}>
                  <Pressable
                    onPress={() => setCheckoutProvider('stripe')}
                    style={[styles.payPill, checkoutProvider === 'stripe' && styles.payPillOn]}
                  >
                    <Text style={[styles.payPillTxt, checkoutProvider === 'stripe' && styles.payPillTxtOn]}>Stripe</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setCheckoutProvider('whop')}
                    style={[styles.payPill, checkoutProvider === 'whop' && styles.payPillOn]}
                  >
                    <Text style={[styles.payPillTxt, checkoutProvider === 'whop' && styles.payPillTxtOn]}>Whop</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

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
                        {checkoutUnlocked ? `Pay ${formatUsdFromCents(selectedPack.priceCents)}` : 'Add credits (device)'}
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
      {whopReady ? <WhopCheckoutHost /> : null}
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
  backLbl: { color: W.cyan, fontWeight: '800', fontSize: 15 },
  topSpacer: { flex: 1 },
  pageInner: { maxWidth: 960, width: '100%', alignSelf: 'center', marginBottom: 8 },
  walletHeroTitle: {
    color: W.cyan,
    fontSize: 28,
    letterSpacing: 4,
    marginBottom: 6,
  },
  walletHeroSub: {
    color: 'rgba(248,250,252,0.88)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 20,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 22,
  },
  cardGridStack: { flexDirection: 'column' },
  vCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: W.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: W.panelBorder,
    padding: 16,
  },
  vCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vCardLbl: {
    color: 'rgba(226,232,240,0.92)',
    fontSize: 12,
    fontWeight: '700',
  },
  vCardVal: { color: '#f8fafc', fontSize: 22, fontWeight: '900', marginBottom: 6 },
  vCardHint: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 11,
    marginBottom: 10,
    lineHeight: 15,
  },
  vCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  btnDeposit: { borderRadius: 999, overflow: 'hidden', flex: 1, minWidth: 120 },
  btnDepositGrad: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDepositTxt: { color: '#052e16', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  btnWithdraw: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.85)',
    backgroundColor: 'rgba(15,23,42,0.6)',
    paddingVertical: 11,
    paddingHorizontal: 14,
    flex: 1,
    minWidth: 120,
    alignItems: 'center',
  },
  btnWithdrawTxt: { color: '#5eead4', fontWeight: '800', fontSize: 12, letterSpacing: 0.6 },
  btnGhostSm: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
  },
  btnGhostSmTxt: { color: W.cyanMuted, fontWeight: '800', fontSize: 12 },
  statSectionLbl: {
    color: 'rgba(226,232,240,0.85)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  statBlocksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statBlock: {
    flex: 1,
    minWidth: 140,
    backgroundColor: W.statBlock,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: W.statBlockBorder,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statBlockVal: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  statBlockCap: { color: 'rgba(240,253,250,0.88)', fontSize: 11, fontWeight: '600' },
  dashboardFoot: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
  },
  tabOn: {
    borderColor: 'rgba(34,211,238,0.45)',
    backgroundColor: 'rgba(15,23,42,0.95)',
    shadowColor: 'rgba(34,211,238,0.25)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  tabTxt: { color: 'rgba(148,163,184,0.95)', fontWeight: '800', fontSize: 13 },
  tabTxtOn: { color: W.cyan },
  walletFeeCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.35)',
    backgroundColor: 'rgba(8,47,73,0.35)',
  },
  walletFeeTitle: {
    color: '#e0f2fe',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  walletFeeBody: { color: 'rgba(226,232,240,0.92)', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  walletFeeRows: { gap: 6 },
  walletFeeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletFeeRowTotal: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.25)',
  },
  walletFeeRowLbl: { color: 'rgba(148,163,184,0.95)', fontSize: 12 },
  walletFeeRowVal: { color: '#e2e8f0', fontSize: 12, fontWeight: '800' },
  walletFeeRowLblStrong: { color: '#f0f9ff', fontSize: 13, fontWeight: '900' },
  walletFeeRowValStrong: { color: runit.neonCyan, fontSize: 15, fontWeight: '900' },
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
  presetOn: { borderColor: runit.neonCyan, backgroundColor: 'rgba(167,139,250,0.08)' },
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
  paySubStrong: { color: '#fff', fontWeight: '900' },
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
  policyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  stripeNote: { color: 'rgba(148,163,184,0.85)', fontSize: 12, lineHeight: 17, marginBottom: 16 },
  payMethodBlock: { marginBottom: 14 },
  payMethodLbl: { color: 'rgba(226,232,240,0.95)', fontWeight: '800', fontSize: 12, marginBottom: 8 },
  payMethodRow: { flexDirection: 'row', gap: 10 },
  payPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(157,78,237,0.45)',
    backgroundColor: 'rgba(8,4,18,0.65)',
  },
  payPillOn: { borderColor: runit.neonCyan, backgroundColor: 'rgba(167,139,250,0.08)' },
  payPillTxt: { color: '#94a3b8', fontWeight: '800', fontSize: 14 },
  payPillTxtOn: { color: runit.neonCyan },
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
    backgroundColor: 'rgba(167,139,250,0.16)',
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
    backgroundColor: 'rgba(167,139,250,0.06)',
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
});
