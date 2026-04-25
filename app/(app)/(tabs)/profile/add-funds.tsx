import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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

import { GuestAuthPromptModal, type GuestAuthPromptVariant } from '@/components/auth/GuestAuthPromptModal';
import { WhopCheckoutHost } from '@/components/wallet/WhopCheckoutHost';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND, WALLET_TOPUP_STRIPE_ENABLED, WHOP_CHECKOUT_ENABLED } from '@/constants/featureFlags';
import { useWalletPaymentSheet } from '@/hooks/useWalletPaymentSheet';
import { useProfile } from '@/hooks/useProfile';
import { useProfileFightStats } from '@/hooks/useProfileFightStats';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { CREDIT_PACKAGES } from '@/lib/creditPackages';
import {
  PAYOUT_BANK_TIMING_WITHDRAWAL_SUCCESS,
  PAYOUT_WHOP_TRANSFER_SUCCESS,
  WALLET_DEPOSIT_WITHDRAW_POLICY,
} from '@/lib/payoutCopy';
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
import { appBorderAccent, runit, runitFont } from '@/lib/runitArcadeTheme';
import {
  assertValidTopUpAmountCents,
  completeCreditsPackagePurchase,
  completeWalletTopUp,
  type WalletCheckoutProvider,
} from '@/services/wallet/completeTopUp';
import {
  fetchStripeConnectStatus,
  openStripeConnectOnboarding,
  type StripeConnectStatus,
} from '@/services/wallet/stripeConnectOnboarding';
import { openWhopPayoutPortal } from '@/services/wallet/whopPayoutOnboarding';
import { withdrawWalletToConnect } from '@/services/wallet/withdrawWallet';
import { withdrawWalletToWhop } from '@/services/wallet/withdrawWalletToWhop';
import { useAuthStore } from '@/store/authStore';

function goBackFromAddFunds(router: ReturnType<typeof useRouter>) {
  safeBack(router, ROUTES.profileTab);
}

function newIdempotencyKey(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function parseUsdToCents(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** Embedded Stripe Payment Sheet — only mount when `StripeProvider` is present (publishable key in .env). */
function WalletPaySheetButton({
  amountCents,
  payLabel,
  onComplete,
  guestBlocked,
  onGuestBlocked,
}: {
  amountCents: number;
  /** e.g. "Pay $10.59" — includes processing fee line */
  payLabel: string;
  onComplete: (completed: boolean) => void;
  guestBlocked?: boolean;
  onGuestBlocked?: () => void;
}) {
  const { payWallet } = useWalletPaymentSheet();
  const [pending, setPending] = useState(false);
  return (
    <Pressable
      onPress={() => {
        if (guestBlocked) {
          onGuestBlocked?.();
          return;
        }
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
      <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
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
  guestBlocked,
  onGuestBlocked,
}: {
  packageId: string;
  payLabel: string;
  onComplete: (completed: boolean) => void;
  guestBlocked?: boolean;
  onGuestBlocked?: () => void;
}) {
  const { payCredits } = useWalletPaymentSheet();
  const [pending, setPending] = useState(false);
  return (
    <Pressable
      onPress={() => {
        if (guestBlocked) {
          onGuestBlocked?.();
          return;
        }
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
      <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
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

function PayWithSelector({
  stripeReady,
  whopReady,
  checkoutProvider,
  setCheckoutProvider,
}: {
  stripeReady: boolean;
  whopReady: boolean;
  checkoutProvider: WalletCheckoutProvider;
  setCheckoutProvider: (p: WalletCheckoutProvider) => void;
}) {
  if (!stripeReady && !whopReady) return null;
  const both = stripeReady && whopReady;
  return (
    <View style={styles.payMethodBlock}>
      <Text style={styles.payMethodLbl}>Pay with</Text>
      {both ? (
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
      ) : (
        <>
          <View style={[styles.payPill, styles.payPillOn, styles.payPillSingle]}>
            <Text style={[styles.payPillTxt, styles.payPillTxtOn]}>{whopReady ? 'Whop' : 'Stripe'}</Text>
          </View>
          <Text style={styles.paySingleRailHint}>
            {whopReady
              ? 'Deposits and credit packs use Whop hosted checkout (browser).'
              : 'Deposits and credit packs use Stripe secure checkout.'}
          </Text>
        </>
      )}
    </View>
  );
}

function initialWalletCheckoutProvider(): WalletCheckoutProvider {
  if (!ENABLE_BACKEND) return 'stripe';
  if (WHOP_CHECKOUT_ENABLED && !WALLET_TOPUP_STRIPE_ENABLED) return 'whop';
  /** Web has no in-app Stripe Payment Sheet; both rails use hosted checkout — prefer Whop when it is enabled. */
  if (Platform.OS === 'web' && WHOP_CHECKOUT_ENABLED) return 'whop';
  return 'stripe';
}

const PRESETS_CENTS = [500, 1000, 2500, 5000] as const;

type DepositStep = 'amount' | 'payment';

/** Wallet shell: gold accents + purple panels (no turquoise). */
const W = {
  cyan: '#FFD700',
  cyanMuted: 'rgba(255,215,0,0.85)',
  lime: '#4ade80',
  limeGrad: ['#4ade80', '#22c55e'] as const,
  panel: 'rgba(15,23,42,0.92)',
  panelBorder: 'rgba(255,215,0,0.22)',
  statBlock: '#5B21B6',
  statBlockBorder: 'rgba(255,215,0,0.35)',
};

export default function AddFundsScreen() {
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const { tab: tabFromRoute, status: checkoutReturnStatus, provider: checkoutReturnProvider } =
    useLocalSearchParams<{ tab?: string; status?: string; provider?: string; session_id?: string }>();
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const fightQ = useProfileFightStats(uid);
  const walletCents = useWalletDisplayCents();
  const prizeCredits = usePrizeCreditsDisplay();
  const cardRow = winW >= 720;

  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [depositStep, setDepositStep] = useState<DepositStep>('amount');
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawStripeStatus, setWithdrawStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [withdrawStripeLoading, setWithdrawStripeLoading] = useState(false);
  const [withdrawUsd, setWithdrawUsd] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [whopPortalBusy, setWhopPortalBusy] = useState(false);
  const [selectedCents, setSelectedCents] = useState<number>(1000);
  const [customDollars, setCustomDollars] = useState('');
  const [selectedPackId, setSelectedPackId] = useState<string>(CREDIT_PACKAGES[1]?.id ?? CREDIT_PACKAGES[0]?.id ?? '');
  const [checkoutProvider, setCheckoutProvider] = useState<WalletCheckoutProvider>(initialWalletCheckoutProvider);
  const [guestAuthPrompt, setGuestAuthPrompt] = useState<GuestAuthPromptVariant | null>(null);

  const connectId = profileQ.data?.stripe_connect_account_id;
  const whopCompanyId = profileQ.data?.whop_company_id;

  useEffect(() => {
    if (uid) setGuestAuthPrompt(null);
  }, [uid]);

  useEffect(() => {
    if (tabFromRoute === 'wallet') {
      if (ENABLE_BACKEND && !uid) setGuestAuthPrompt('wallet');
      else {
        setDepositModalVisible(true);
        setDepositStep('amount');
      }
    }
  }, [tabFromRoute, uid]);

  /** Web: Stripe / Whop hosted checkout uses full-page redirect; resume UX from `successUrl` / `cancelUrl`. */
  const checkoutReturnHandledRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!ENABLE_BACKEND) return;

    const st = checkoutReturnStatus;
    if (st !== 'success' && st !== 'cancel') {
      checkoutReturnHandledRef.current = false;
      return;
    }
    if (checkoutReturnHandledRef.current) return;
    checkoutReturnHandledRef.current = true;

    const isWhop = checkoutReturnProvider === 'whop';
    const partner = isWhop ? 'Whop' : 'Stripe';

    const finish = () => {
      router.replace('/(app)/(tabs)/profile/add-funds');
    };

    if (st === 'cancel') {
      Alert.alert('Checkout', 'Payment was cancelled.', [{ text: 'OK', onPress: finish }]);
      return;
    }

    if (uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
    Alert.alert(
      'Payment',
      `Thanks! Your balance updates within a few seconds after ${partner} confirms the payment.`,
      [{ text: 'OK', onPress: finish }],
    );
  }, [checkoutReturnStatus, checkoutReturnProvider, uid, qc, router]);

  useEffect(() => {
    if (!depositModalVisible) setDepositStep('amount');
  }, [depositModalVisible]);

  useEffect(() => {
    if (!withdrawModalVisible) setWithdrawUsd('');
  }, [withdrawModalVisible]);

  const loadWithdrawStripeStatus = useCallback(async () => {
    if (!ENABLE_BACKEND || !uid) {
      setWithdrawStripeStatus(null);
      return;
    }
    setWithdrawStripeLoading(true);
    try {
      const s = await fetchStripeConnectStatus();
      setWithdrawStripeStatus(s);
    } finally {
      setWithdrawStripeLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (withdrawModalVisible) void loadWithdrawStripeStatus();
  }, [withdrawModalVisible, loadWithdrawStripeStatus]);

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

  const walletFeeCents = ENABLE_BACKEND ? walletDepositProcessingFeeCents(amountCents) : 0;
  const walletTotalChargeCents = ENABLE_BACKEND ? walletDepositTotalChargeCents(amountCents) : amountCents;

  const selectedPack = useMemo(
    () => CREDIT_PACKAGES.find((p) => p.id === selectedPackId) ?? CREDIT_PACKAGES[0],
    [selectedPackId],
  );

  const backendPending = ENABLE_BACKEND && !checkoutUnlocked;
  const stripePk = env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const useEmbeddedSheet =
    stripeReady && checkoutProvider === 'stripe' && Platform.OS !== 'web' && !!stripePk;
  const payRailName = checkoutProvider === 'whop' ? 'Whop' : 'Stripe';

  const depositAmountStepCopy = useMemo(() => {
    if (!checkoutUnlocked) {
      return ENABLE_BACKEND
        ? 'Card checkout is not enabled in this build. Turn on Stripe and/or Whop in your project environment.'
        : 'Guest mode: continue adds demo cash on this device.';
    }
    if (stripeReady && whopReady) {
      return 'On the next step, choose Stripe or Whop, then complete checkout with your selected partner.';
    }
    if (whopReady) return 'You will complete checkout with Whop (secure browser window).';
    return 'You will complete checkout with Stripe (secure browser or in-app card sheet on supported builds).';
  }, [checkoutUnlocked, stripeReady, whopReady, ENABLE_BACKEND]);

  const handleWalletPaid = useCallback(
    (completed: boolean) => {
      if (completed && ENABLE_BACKEND && uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      if (completed) {
        setDepositModalVisible(false);
        setDepositStep('amount');
        Alert.alert(
          'Payment',
          checkoutUnlocked
            ? `Thanks! Your cash balance updates within a few seconds after ${payRailName} confirms the payment.`
            : `${formatUsdFromCents(amountCents)} added to your wallet.`,
        );
      }
    },
    [amountCents, checkoutUnlocked, payRailName, qc, uid],
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
    if (ENABLE_BACKEND && !uid) {
      setGuestAuthPrompt('wallet');
      return;
    }
    try {
      assertValidTopUpAmountCents(amountCents);
    } catch (e) {
      Alert.alert('Amount', e instanceof Error ? e.message : 'Invalid amount');
      return;
    }
    setDepositStep('payment');
  }, [amountCents, uid]);

  const onPayWallet = useCallback(() => {
    if (ENABLE_BACKEND && !uid) {
      setGuestAuthPrompt('wallet');
      return;
    }
    topUpWallet.mutate();
  }, [topUpWallet, uid]);

  const onPayCredits = useCallback(() => {
    if (ENABLE_BACKEND && !uid) {
      setGuestAuthPrompt('arcade_credits');
      return;
    }
    if (!selectedPackId) {
      Alert.alert('Credits', 'Choose a package.');
      return;
    }
    buyCredits.mutate();
  }, [buyCredits, selectedPackId, uid]);

  const stripePayoutReady = useMemo(
    () => withdrawStripeStatus?.payouts_enabled === true,
    [withdrawStripeStatus?.payouts_enabled],
  );
  const hasStripeAccount = useMemo(
    () => !!(connectId || withdrawStripeStatus?.connected),
    [connectId, withdrawStripeStatus?.connected],
  );

  const onStripeConnectFromModal = useCallback(async () => {
    if (!ENABLE_BACKEND) {
      Alert.alert('Not available', 'Sign in with an online account to set up bank payouts.');
      return;
    }
    try {
      await openStripeConnectOnboarding();
      if (uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      await loadWithdrawStripeStatus();
    } catch (e) {
      Alert.alert('Connect', e instanceof Error ? e.message : 'Could not open onboarding');
    }
  }, [qc, uid, loadWithdrawStripeStatus]);

  const onOpenWhopPortalFromModal = useCallback(async () => {
    if (!ENABLE_BACKEND || !uid) return;
    setWhopPortalBusy(true);
    try {
      await openWhopPayoutPortal();
      void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      await loadWithdrawStripeStatus();
    } catch (e) {
      Alert.alert('Whop payouts', e instanceof Error ? e.message : 'Could not open Whop');
    } finally {
      setWhopPortalBusy(false);
    }
  }, [qc, uid, loadWithdrawStripeStatus]);

  const onWithdrawStripe = useCallback(async () => {
    if (!uid || !ENABLE_BACKEND) return;
    if (withdrawStripeLoading) {
      Alert.alert('One moment', 'Still checking your payout setup with Stripe.');
      return;
    }
    const cents = parseUsdToCents(withdrawUsd);
    if (cents == null) {
      Alert.alert('Amount', 'Enter a valid dollar amount (e.g. 10 or 10.50).');
      return;
    }
    if (cents < 100) {
      Alert.alert('Minimum', 'Minimum withdrawal is $1.00.');
      return;
    }
    if (cents > walletCents) {
      Alert.alert('Balance', `You only have ${formatUsdFromCents(walletCents)} available.`);
      return;
    }
    if (!stripePayoutReady) {
      Alert.alert(
        'Finish setup',
        'Complete Stripe bank payouts before withdrawing. Use “Continue setup” below.',
      );
      return;
    }
    setWithdrawing(true);
    try {
      await withdrawWalletToConnect({
        amountCents: cents,
        idempotencyKey: newIdempotencyKey(),
      });
      setWithdrawUsd('');
      void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions(uid) });
      setWithdrawModalVisible(false);
      Alert.alert('Withdrawal started', PAYOUT_BANK_TIMING_WITHDRAWAL_SUCCESS);
      await loadWithdrawStripeStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (/Connect a bank account|Complete Stripe payout/i.test(msg)) {
        Alert.alert(
          'Setup needed',
          'Connect and verify a bank account in Stripe before withdrawing.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open setup', onPress: () => void onStripeConnectFromModal() },
          ],
        );
        return;
      }
      Alert.alert('Withdrawal failed', msg);
    } finally {
      setWithdrawing(false);
    }
  }, [
    uid,
    withdrawUsd,
    walletCents,
    qc,
    loadWithdrawStripeStatus,
    withdrawStripeLoading,
    stripePayoutReady,
    onStripeConnectFromModal,
  ]);

  const onWithdrawWhop = useCallback(async () => {
    if (!uid || !ENABLE_BACKEND) return;
    if (!whopCompanyId) {
      Alert.alert(
        'Whop account required',
        'Open the Whop payout portal first so we can create your connected account.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open portal', onPress: () => void onOpenWhopPortalFromModal() },
        ],
      );
      return;
    }
    const cents = parseUsdToCents(withdrawUsd);
    if (cents == null) {
      Alert.alert('Amount', 'Enter a valid dollar amount (e.g. 10 or 10.50).');
      return;
    }
    if (cents < 100) {
      Alert.alert('Minimum', 'Minimum withdrawal is $1.00.');
      return;
    }
    if (cents > walletCents) {
      Alert.alert('Balance', `You only have ${formatUsdFromCents(walletCents)} available.`);
      return;
    }
    setWithdrawing(true);
    try {
      await withdrawWalletToWhop({
        amountCents: cents,
        idempotencyKey: newIdempotencyKey(),
      });
      setWithdrawUsd('');
      void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      void qc.invalidateQueries({ queryKey: queryKeys.transactions(uid) });
      setWithdrawModalVisible(false);
      Alert.alert('Sent to Whop', PAYOUT_WHOP_TRANSFER_SUCCESS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (/Open Whop payouts|connected account/i.test(msg)) {
        Alert.alert(
          'Finish Whop setup',
          'Create your Whop connected account in the payout portal first.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open portal', onPress: () => void onOpenWhopPortalFromModal() },
          ],
        );
        return;
      }
      Alert.alert('Withdrawal failed', msg);
    } finally {
      setWithdrawing(false);
    }
  }, [uid, whopCompanyId, withdrawUsd, walletCents, qc, onOpenWhopPortalFromModal]);

  const wins = fightQ.data?.wins ?? 0;
  const losses = fightQ.data?.losses ?? 0;
  const played = wins + losses;
  const winRateStr =
    ENABLE_BACKEND && uid && played > 0 ? `${Math.round((100 * wins) / played)}%` : '—';
  const recordStr = ENABLE_BACKEND && uid && played > 0 ? `${wins}/${played}` : '—';

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBackFromAddFunds(router)} style={styles.backBtn} accessibilityRole="button">
          <SafeIonicons name="chevron-back" size={24} color={W.cyan} />
          <Text style={styles.backLbl}>Back</Text>
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
                    if (ENABLE_BACKEND && !uid) setGuestAuthPrompt('wallet');
                    else {
                      setDepositStep('amount');
                      setDepositModalVisible(true);
                    }
                  }}
                  style={({ pressed }) => [styles.btnDeposit, pressed && { opacity: 0.92 }]}
                >
                  <LinearGradient colors={W.limeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnDepositGrad}>
                    <Text style={styles.btnDepositTxt}>+ DEPOSIT</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() =>
                    ENABLE_BACKEND && !uid ? setGuestAuthPrompt('withdraw') : setWithdrawModalVisible(true)
                  }
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
              <Text style={styles.vCardHint}>Prize runs & ticket economy · packs below</Text>
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

        {backendPending ? (
          <View style={styles.banner}>
            <SafeIonicons name="information-circle" size={20} color="#FDE047" />
            <Text style={styles.bannerTxt}>
              In-app top-ups aren&apos;t enabled in this build yet (enable Stripe and/or Whop checkout in your project environment). You
              can still browse pricing; check back after configuration or contact support if you need to add cash.
            </Text>
          </View>
        ) : null}

        {checkoutProvider === 'stripe' && stripeReady && Platform.OS !== 'web' && !stripePk ? (
          <View style={styles.banner}>
            <SafeIonicons name="information-circle" size={20} color="#93c5fd" />
            <Text style={styles.bannerTxt}>
              Card entry inside the app isn&apos;t configured in this build.
              {whopReady
                ? ' Tap Pay with → Whop below for hosted checkout, or use a build with a Stripe publishable key for in-app cards.'
                : ' Use any on-screen web checkout option, or update the app when a new version is available.'}
            </Text>
          </View>
        ) : null}


        <>
            <Text style={styles.statSectionLbl}>BUY ARCADE CREDITS</Text>
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

            <PayWithSelector
              stripeReady={stripeReady}
              whopReady={whopReady}
              checkoutProvider={checkoutProvider}
              setCheckoutProvider={setCheckoutProvider}
            />

            {useEmbeddedSheet ? (
              <CreditsPaySheetButton
                packageId={selectedPackId}
                payLabel={`Pay ${formatUsdFromCents(selectedPack.priceCents)}`}
                onComplete={handleCreditsPaid}
                guestBlocked={ENABLE_BACKEND && !uid}
                onGuestBlocked={() => setGuestAuthPrompt('arcade_credits')}
              />
            ) : (
              <Pressable
                onPress={onPayCredits}
                disabled={buyCredits.isPending}
                style={({ pressed }) => [styles.ctaOuter, pressed && !buyCredits.isPending && { opacity: 0.92 }]}
              >
                <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
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

        {ENABLE_BACKEND && stripeReady ? (
          <Pressable onPress={() => router.push('/(app)/(tabs)/profile/stripe-connect')} style={styles.linkRow}>
            <SafeIonicons name="link-outline" size={18} color={runit.neonCyan} />
            <Text style={styles.linkTxt}>Payout details — Stripe Connect</Text>
            <SafeIonicons name="chevron-forward" size={18} color="rgba(148,163,184,0.8)" />
          </Pressable>
        ) : null}

        {ENABLE_BACKEND ? (
          <Pressable onPress={() => router.push('/(app)/(tabs)/profile/whop-payouts')} style={styles.linkRow}>
            <SafeIonicons name="open-outline" size={18} color={runit.neonCyan} />
            <Text style={styles.linkTxt}>Whop payouts (optional)</Text>
            <SafeIonicons name="chevron-forward" size={18} color="rgba(148,163,184,0.8)" />
          </Pressable>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal
        visible={depositModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDepositModalVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setDepositModalVisible(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>+ DEPOSIT FUNDS</Text>
              <Pressable
                onPress={() => setDepositModalVisible(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <SafeIonicons name="close" size={26} color="rgba(148,163,184,0.95)" />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.sheetScroll}
            >
              {depositStep === 'amount' ? (
                <>
                  <View style={styles.sheetPresets}>
                    {PRESETS_CENTS.map((c) => {
                      const active = customDollars.trim() === '' && selectedCents === c;
                      return (
                        <Pressable
                          key={c}
                          onPress={() => {
                            setCustomDollars('');
                            setSelectedCents(c);
                          }}
                          style={({ pressed }) => [
                            styles.sheetPreset,
                            active && styles.sheetPresetOn,
                            pressed && { opacity: 0.88 },
                          ]}
                        >
                          <Text style={[styles.sheetPresetTxt, active && styles.sheetPresetTxtOn]}>
                            {formatUsdFromCents(c)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    style={styles.sheetInput}
                    placeholder="$ Custom amount"
                    placeholderTextColor="rgba(148,163,184,0.45)"
                    keyboardType="decimal-pad"
                    value={customDollars}
                    onChangeText={setCustomDollars}
                  />
                  {checkoutUnlocked && uid ? (
                    <Text style={styles.sheetPolicy}>{WALLET_DEPOSIT_WITHDRAW_POLICY}</Text>
                  ) : null}
                  {ENABLE_BACKEND ? (
                    <View style={styles.sheetFeeMini}>
                      <View style={styles.sheetFeeRow}>
                        <Text style={styles.sheetFeeLbl}>Wallet credit</Text>
                        <Text style={styles.sheetFeeVal}>{formatUsdFromCents(amountCents)}</Text>
                      </View>
                      <View style={styles.sheetFeeRow}>
                        <Text style={styles.sheetFeeLbl}>Card processing</Text>
                        <Text style={styles.sheetFeeVal}>{formatUsdFromCents(walletFeeCents)}</Text>
                      </View>
                      <View style={[styles.sheetFeeRow, styles.sheetFeeRowTotal]}>
                        <Text style={styles.sheetFeeLblStrong}>You pay</Text>
                        <Text style={styles.sheetFeeValStrong}>{formatUsdFromCents(walletTotalChargeCents)}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.sheetHint}>Guest mode adds the full amount on this device (demo).</Text>
                  )}
                  <Text style={styles.sheetPartner}>{depositAmountStepCopy}</Text>
                  <Pressable
                    onPress={() => void onContinueToPayment()}
                    style={({ pressed }) => [styles.sheetCtaOuter, pressed && { opacity: 0.92 }]}
                  >
                    <LinearGradient colors={W.limeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetCtaGrad}>
                      <SafeIonicons name="open-outline" size={20} color="#052e16" />
                      <Text style={styles.sheetCtaTxtDark}>Continue to payment</Text>
                    </LinearGradient>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => setDepositStep('amount')}
                    style={styles.sheetBackRow}
                    accessibilityRole="button"
                  >
                    <SafeIonicons name="chevron-back" size={20} color={W.cyan} />
                    <Text style={styles.sheetBackLbl}>Amount</Text>
                  </Pressable>
                  <Text style={styles.paySub}>
                    {formatUsdFromCents(amountCents)} to your wallet · {formatUsdFromCents(walletFeeCents)} processing ·{' '}
                    <Text style={styles.paySubStrong}>{formatUsdFromCents(walletTotalChargeCents)} charged</Text>
                  </Text>
                  <PayWithSelector
                    stripeReady={stripeReady}
                    whopReady={whopReady}
                    checkoutProvider={checkoutProvider}
                    setCheckoutProvider={setCheckoutProvider}
                  />
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
                      guestBlocked={ENABLE_BACKEND && !uid}
                      onGuestBlocked={() => setGuestAuthPrompt('wallet')}
                    />
                  ) : (
                    <Pressable
                      onPress={onPayWallet}
                      disabled={topUpWallet.isPending}
                      style={({ pressed }) => [styles.sheetCtaOuter, pressed && !topUpWallet.isPending && { opacity: 0.92 }]}
                    >
                      <LinearGradient colors={W.limeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetCtaGrad}>
                        {topUpWallet.isPending ? (
                          <ActivityIndicator color="#052e16" />
                        ) : (
                          <>
                            <SafeIonicons name="open-outline" size={20} color="#052e16" />
                            <Text style={styles.sheetCtaTxtDark}>
                              {checkoutUnlocked ? `Pay ${formatUsdFromCents(walletTotalChargeCents)}` : 'Add cash (device)'}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </Pressable>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setWithdrawModalVisible(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>− WITHDRAW</Text>
              <Pressable
                onPress={() => setWithdrawModalVisible(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <SafeIonicons name="close" size={26} color="rgba(148,163,184,0.95)" />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
              {withdrawStripeLoading && ENABLE_BACKEND && uid ? (
                <ActivityIndicator color={W.cyan} style={{ marginVertical: 24 }} />
              ) : !ENABLE_BACKEND ? (
                <Text style={styles.sheetHint}>Sign in with an online account to withdraw cash to your bank.</Text>
              ) : !uid ? (
                <Text style={styles.sheetHint}>Create an account or sign in to withdraw.</Text>
              ) : stripePayoutReady ? (
                <>
                  <Text style={styles.sheetBody}>
                    Available: <Text style={styles.sheetBodyStrong}>{formatUsdFromCents(walletCents)}</Text>
                  </Text>
                  <TextInput
                    style={styles.sheetInput}
                    placeholder="Amount (USD)"
                    placeholderTextColor="rgba(148,163,184,0.45)"
                    keyboardType="decimal-pad"
                    value={withdrawUsd}
                    onChangeText={setWithdrawUsd}
                  />
                  <Text style={styles.sheetPartner}>Funds move to your connected bank through Stripe (min $1.00).</Text>
                  <Pressable
                    onPress={() => void onWithdrawStripe()}
                    disabled={withdrawing}
                    style={({ pressed }) => [styles.sheetCtaOuter, pressed && !withdrawing && { opacity: 0.92 }]}
                  >
                    <LinearGradient colors={W.limeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetCtaGrad}>
                      {withdrawing ? (
                        <ActivityIndicator color="#052e16" />
                      ) : (
                        <>
                          <SafeIonicons name="cash-outline" size={20} color="#052e16" />
                          <Text style={styles.sheetCtaTxtDark}>Withdraw to bank</Text>
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                </>
              ) : whopCompanyId ? (
                <>
                  <Text style={styles.sheetBody}>
                    Whop is linked. Move cash to your Whop balance, then cash out from their payout portal.
                  </Text>
                  <Text style={styles.sheetBody}>
                    Available: <Text style={styles.sheetBodyStrong}>{formatUsdFromCents(walletCents)}</Text>
                  </Text>
                  <TextInput
                    style={styles.sheetInput}
                    placeholder="Amount (USD)"
                    placeholderTextColor="rgba(148,163,184,0.45)"
                    keyboardType="decimal-pad"
                    value={withdrawUsd}
                    onChangeText={setWithdrawUsd}
                  />
                  <Pressable
                    onPress={() => void onWithdrawWhop()}
                    disabled={withdrawing}
                    style={({ pressed }) => [styles.sheetCtaOuter, pressed && !withdrawing && { opacity: 0.92 }]}
                  >
                    <LinearGradient colors={W.limeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetCtaGrad}>
                      {withdrawing ? (
                        <ActivityIndicator color="#052e16" />
                      ) : (
                        <>
                          <SafeIonicons name="open-outline" size={20} color="#052e16" />
                          <Text style={styles.sheetCtaTxtDark}>Send to Whop</Text>
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => void onOpenWhopPortalFromModal()}
                    disabled={whopPortalBusy}
                    style={({ pressed }) => [styles.sheetSecondary, pressed && { opacity: 0.9 }]}
                  >
                    {whopPortalBusy ? (
                      <ActivityIndicator color={W.cyan} />
                    ) : (
                      <Text style={styles.sheetSecondaryTxt}>Open Whop payout portal</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.sheetBody}>
                    {hasStripeAccount
                      ? 'Stripe still needs a verified bank before we can send cash. Continue setup in the secure browser flow.'
                      : 'Connect a bank account to withdraw. Card deposits do not require this — only cash-outs.'}
                  </Text>
                  <Pressable
                    onPress={() => void onStripeConnectFromModal()}
                    style={({ pressed }) => [styles.sheetCtaOuter, pressed && { opacity: 0.92 }]}
                  >
                    <LinearGradient colors={W.limeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetCtaGrad}>
                      <SafeIonicons name="link-outline" size={20} color="#052e16" />
                      <Text style={styles.sheetCtaTxtDark}>{hasStripeAccount ? 'Continue Stripe setup' : 'Set up Stripe payouts'}</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => void onOpenWhopPortalFromModal()}
                    disabled={whopPortalBusy}
                    style={({ pressed }) => [styles.sheetSecondary, pressed && { opacity: 0.9 }]}
                  >
                    {whopPortalBusy ? (
                      <ActivityIndicator color={W.cyan} />
                    ) : (
                      <Text style={styles.sheetSecondaryTxt}>Or use Whop payouts</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/(app)/(tabs)/profile/stripe-connect')}
                    style={({ pressed }) => [styles.sheetTertiary, pressed && { opacity: 0.88 }]}
                  >
                    <Text style={styles.sheetTertiaryTxt}>Full payout screen →</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <GuestAuthPromptModal
        visible={guestAuthPrompt != null}
        variant={guestAuthPrompt ?? 'wallet'}
        onClose={() => setGuestAuthPrompt(null)}
      />

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
  btnWithdrawTxt: { color: '#FFD700', fontWeight: '800', fontSize: 12, letterSpacing: 0.6 },
  btnGhostSm: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
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
    borderColor: 'rgba(255,215,0,0.2)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
  },
  tabOn: {
    borderColor: 'rgba(255,215,0,0.45)',
    backgroundColor: 'rgba(15,23,42,0.95)',
    shadowColor: 'rgba(255,215,0,0.25)',
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
    borderColor: 'rgba(255,215,0,0.35)',
    backgroundColor: 'rgba(8,47,73,0.35)',
  },
  walletFeeTitle: {
    color: '#FFF8E1',
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
    borderColor: appBorderAccent,
    backgroundColor: 'rgba(8,4,18,0.65)',
  },
  presetOn: { borderColor: runit.neonCyan, backgroundColor: 'rgba(167,139,250,0.08)' },
  presetTxt: { color: '#e2e8f0', fontWeight: '800', fontSize: 15 },
  presetTxtOn: { color: runit.neonCyan },
  customLbl: { color: 'rgba(148,163,184,0.9)', fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: appBorderAccent,
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
  payPillSingle: { alignSelf: 'flex-start' },
  paySingleRailHint: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  payPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: appBorderAccent,
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
    borderColor: appBorderAccent,
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
    borderColor: appBorderAccent,
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
  sheetOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 18 },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.76)' },
  sheetCard: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(10,14,28,0.98)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.28)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    maxHeight: 560,
  },
  sheetScroll: { maxHeight: 480 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  sheetPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  sheetPreset: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.9)',
    backgroundColor: 'rgba(15,23,42,0.95)',
    minWidth: '22%',
    flexGrow: 1,
    alignItems: 'center',
  },
  sheetPresetOn: {
    borderColor: 'rgba(255,215,0,0.75)',
    backgroundColor: 'rgba(8,47,73,0.5)',
  },
  sheetPresetTxt: { color: '#e2e8f0', fontWeight: '800', fontSize: 14 },
  sheetPresetTxtOn: { color: W.cyan },
  sheetInput: {
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.95)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: 'rgba(15,23,42,0.92)',
    marginBottom: 12,
  },
  sheetPolicy: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  sheetFeeMini: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
    backgroundColor: 'rgba(8,47,73,0.28)',
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  sheetFeeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetFeeLbl: { color: 'rgba(148,163,184,0.95)', fontSize: 12 },
  sheetFeeVal: { color: '#e2e8f0', fontSize: 12, fontWeight: '800' },
  sheetFeeRowTotal: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.2)',
  },
  sheetFeeLblStrong: { color: '#f0f9ff', fontSize: 13, fontWeight: '900' },
  sheetFeeValStrong: { color: W.cyan, fontSize: 14, fontWeight: '900' },
  sheetHint: { color: 'rgba(148,163,184,0.88)', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  sheetPartner: {
    color: 'rgba(148,163,184,0.82)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  sheetCtaOuter: { borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  sheetCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  sheetCtaTxtDark: { color: '#052e16', fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
  sheetBackRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  sheetBackLbl: { color: W.cyan, fontWeight: '800', fontSize: 14 },
  sheetBody: { color: 'rgba(226,232,240,0.95)', fontSize: 14, lineHeight: 21, marginBottom: 12 },
  sheetBodyStrong: { color: '#f8fafc', fontWeight: '900' },
  sheetSecondary: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  sheetSecondaryTxt: { color: W.cyan, fontWeight: '800', fontSize: 14 },
  sheetTertiary: { paddingVertical: 10, alignItems: 'center' },
  sheetTertiaryTxt: { color: 'rgba(148,163,184,0.9)', fontWeight: '700', fontSize: 13 },
});
