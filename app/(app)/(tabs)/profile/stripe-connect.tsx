import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND, WALLET_TOPUP_STRIPE_ENABLED } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { ROUTES, safeBack } from '@/lib/appNavigation';
import { formatUsdFromCents } from '@/lib/money';
import { queryKeys } from '@/lib/queryKeys';
import { PAYOUT_BANK_TIMING_SHORT, PAYOUT_BANK_TIMING_WITHDRAWAL_SUCCESS } from '@/lib/payoutCopy';
import { STRIPE_CONNECT_PREFILL_SUMMARY } from '@/lib/stripeConnectPrefill';
import {
  fetchStripeConnectStatus,
  openStripeConnectOnboarding,
  type StripeConnectStatus,
} from '@/services/wallet/stripeConnectOnboarding';
import { withdrawWalletToConnect } from '@/services/wallet/withdrawWallet';
import { runit, runitFont, runitTextGlowCyan } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';

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

export default function StripeConnectScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const connectId = profileQ.data?.stripe_connect_account_id;
  const walletCents = useWalletDisplayCents();

  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusStale, setStatusStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawUsd, setWithdrawUsd] = useState('');

  const loadStatus = useCallback(async () => {
    if (!ENABLE_BACKEND || !WALLET_TOPUP_STRIPE_ENABLED || !uid) {
      setStatusLoading(false);
      setStatusStale(false);
      return;
    }
    setStatusLoading(true);
    try {
      const s = await fetchStripeConnectStatus();
      setStatus(s);
      setStatusStale(s === null);
    } finally {
      setStatusLoading(false);
    }
  }, [uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStatus();
      if (uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
    } finally {
      setRefreshing(false);
    }
  }, [loadStatus, qc, uid]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const onStart = useCallback(async () => {
    if (!ENABLE_BACKEND || !WALLET_TOPUP_STRIPE_ENABLED) {
      Alert.alert(
        'Not configured',
        'Enable Stripe in your project (EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED) and deploy createStripeConnectLink + getStripeConnectAccount.',
      );
      return;
    }
    setBusy(true);
    try {
      await openStripeConnectOnboarding();
      if (uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      await loadStatus();
    } catch (e) {
      Alert.alert('Connect', e instanceof Error ? e.message : 'Could not open onboarding');
    } finally {
      setBusy(false);
    }
  }, [qc, uid, loadStatus]);

  const onOpenDashboard = useCallback(() => {
    const url = status?.dashboard_url;
    if (url) void Linking.openURL(url);
  }, [status?.dashboard_url]);

  const hasAccount = !!(connectId || status?.connected);
  const payoutsReady = status?.payouts_enabled === true;

  /** Explains what’s missing and offers actions (Connect bank / Continue / Dashboard). */
  const promptPayoutGate = useCallback(() => {
    if (statusStale) {
      Alert.alert(
        'Can’t verify payout status',
        'We couldn’t reach Stripe to confirm your setup. Check your connection, pull down on this screen to refresh, then try again.',
      );
      return;
    }
    const title = !hasAccount ? 'Connect your bank first' : 'Finish payout setup';
    let body = !hasAccount
      ? 'Withdrawals go to your bank through Stripe. Tap “Set up bank” to open secure onboarding and link an account — we can’t send cash until that’s done.'
      : 'Stripe still needs your bank or identity details before payouts are enabled. Use “Continue setup” to finish in the browser, or “Open dashboard” if Stripe asked for documents or verification.';
    if (status?.requirements_currently_due && status.requirements_currently_due.length > 0) {
      body += '\n\nStripe is waiting on more information from you (check the dashboard for details).';
    } else if (hasAccount && status?.details_submitted === false) {
      body += '\n\nComplete the remaining steps in Stripe’s form.';
    }
    const actions: { text: string; style?: 'cancel'; onPress?: () => void }[] = [
      { text: 'Not now', style: 'cancel' },
    ];
    if (hasAccount && status?.dashboard_url) {
      actions.push({
        text: 'Open dashboard',
        onPress: () => void Linking.openURL(status.dashboard_url!),
      });
    }
    actions.push({
      text: hasAccount ? 'Continue setup' : 'Set up bank',
      onPress: () => void onStart(),
    });
    Alert.alert(title, body, actions);
  }, [hasAccount, onStart, status, statusStale]);

  const onWithdraw = useCallback(async () => {
    if (!uid || !ENABLE_BACKEND || !WALLET_TOPUP_STRIPE_ENABLED) return;
    if (statusLoading) {
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
    if (statusStale || !payoutsReady) {
      promptPayoutGate();
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
      Alert.alert('Withdrawal started', PAYOUT_BANK_TIMING_WITHDRAWAL_SUCCESS);
      await loadStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (/Connect a bank account|Complete Stripe payout/i.test(msg)) {
        promptPayoutGate();
        return;
      }
      if (/platform balance|Stripe platform|insufficient/i.test(msg)) {
        Alert.alert(
          'Can’t complete withdrawal',
          'The transfer couldn’t be completed — often this means the platform’s Stripe balance is too low for this amount. Try a smaller amount later, or contact support if it keeps happening.',
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
    loadStatus,
    statusLoading,
    statusStale,
    payoutsReady,
    promptPayoutGate,
  ]);

  const canEnterAmount = !withdrawing && walletCents >= 100 && !statusLoading;
  const canTapWithdraw =
    !withdrawing && !statusLoading && walletCents >= 100;
  const withdrawReady = !statusStale && payoutsReady;
  const withdrawBtnColors: [string, string] =
    !canTapWithdraw || statusLoading
      ? ['#334155', '#475569']
      : withdrawReady
        ? ['#059669', '#10b981']
        : ['#b45309', '#f59e0b'];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={runit.neonCyan} />}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => safeBack(router, ROUTES.profileTab)} style={styles.backBtn} accessibilityRole="button">
            <Ionicons name="chevron-back" size={24} color={runit.neonCyan} />
            <Text style={styles.backLbl}>Back</Text>
          </Pressable>
          <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowCyan]}>PAYOUTS</Text>
          <View style={styles.topSpacer} />
        </View>

        <LinearGradient colors={[runit.neonPurple, '#1e1b4b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <Text style={styles.head}>Bank payouts (Stripe)</Text>
          <Text style={styles.body}>
            Connect a bank account through Stripe so we can send your winnings and withdrawals. RunitArcade sends your profile
            details and contest category to Stripe so you mostly add bank info — we don't run a separate ID check in this app.
          </Text>

          <Text style={styles.prefillHead}>Prefilled from RunitArcade</Text>
          {STRIPE_CONNECT_PREFILL_SUMMARY.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletTxt}>{line}</Text>
            </View>
          ))}

          {statusLoading ? (
            <Text style={styles.meta}>Checking payout status…</Text>
          ) : hasAccount ? (
            <>
              <Text style={styles.meta}>Account: {connectId ?? status?.account_id ?? '—'}</Text>
              <Text style={[styles.statusLine, payoutsReady && styles.statusOk]}>
                {payoutsReady ? 'Payouts enabled — bank connected.' : 'Finish Stripe steps to enable payouts.'}
              </Text>
            </>
          ) : (
            <Text style={styles.meta}>Not connected yet — tap below to add your bank on Stripe's secure page.</Text>
          )}

          <Pressable
            onPress={() => void onStart()}
            disabled={busy || !uid}
            style={({ pressed }) => [styles.ctaOuter, pressed && !busy && { opacity: 0.9 }]}
          >
            <LinearGradient colors={['#0369a1', '#0ea5e9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaTxt}>{hasAccount ? 'Continue / update bank setup' : 'Connect bank (Stripe)'}</Text>
              )}
            </LinearGradient>
          </Pressable>

          {status?.dashboard_url ? (
            <Pressable onPress={onOpenDashboard} style={styles.dashBtn}>
              <Text style={styles.dashTxt}>Open Stripe Express dashboard</Text>
              <Ionicons name="open-outline" size={16} color={runit.neonCyan} />
            </Pressable>
          ) : null}

          {!uid ? <Text style={styles.warn}>Sign in to set up payouts.</Text> : null}
          <Text style={styles.legal}>
            Stripe may still ask for identity or extra steps for legal compliance — we don't control that in-app.
          </Text>
        </LinearGradient>

        {ENABLE_BACKEND && WALLET_TOPUP_STRIPE_ENABLED && uid ? (
          <LinearGradient colors={['#0f172a', '#1e1b4b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <Text style={styles.head}>Withdraw cash</Text>
            <Text style={styles.body}>
              Available balance: <Text style={styles.em}>{formatUsdFromCents(walletCents)}</Text>. Minimum $1.00. We verify your
              balance on the server, then send funds to your Stripe Connect account — Stripe routes them to your linked bank.
            </Text>
            <Text style={styles.timingNote}>{PAYOUT_BANK_TIMING_SHORT}</Text>

            {statusStale ? (
              <View style={styles.callout}>
                <Ionicons name="cloud-offline-outline" size={22} color="#93c5fd" />
                <Text style={styles.calloutTxt}>
                  Could not load your payout status from Stripe. Pull down to refresh, then try again.
                </Text>
              </View>
            ) : null}

            {!statusLoading && !withdrawReady && walletCents >= 100 ? (
              <View style={styles.calloutWarn}>
                <Ionicons name="information-circle" size={22} color="#fbbf24" />
                <Text style={styles.calloutTxt}>
                  {hasAccount
                    ? 'Payouts are not enabled yet — finish Stripe steps (bank or ID) before we can send cash. Tap Withdraw below for shortcuts.'
                    : 'You need to connect a bank through Stripe before withdrawals. Tap Withdraw below for steps, or use Connect bank above.'}
                </Text>
              </View>
            ) : null}

            <TextInput
              value={withdrawUsd}
              onChangeText={setWithdrawUsd}
              keyboardType="decimal-pad"
              placeholder="Amount in USD (e.g. 25)"
              placeholderTextColor="rgba(148,163,184,0.5)"
              style={[styles.input, !canEnterAmount && styles.inputMuted]}
              editable={canEnterAmount}
            />
            <Pressable
              onPress={() => void onWithdraw()}
              disabled={!canTapWithdraw}
              style={({ pressed }) => [styles.ctaOuter, pressed && canTapWithdraw && { opacity: 0.9 }]}
            >
              <LinearGradient colors={withdrawBtnColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
                {withdrawing ? (
                  <ActivityIndicator color="#fff" />
                ) : statusLoading ? (
                  <Text style={styles.ctaTxt}>Checking payout status…</Text>
                ) : walletCents < 100 ? (
                  <Text style={styles.ctaTxt}>Need at least $1.00 to withdraw</Text>
                ) : !withdrawReady ? (
                  <Text style={styles.ctaTxt}>Withdraw — finish setup first</Text>
                ) : (
                  <Text style={styles.ctaTxt}>Withdraw to connected account</Text>
                )}
              </LinearGradient>
            </Pressable>
            {walletCents < 100 ? (
              <Text style={styles.hint}>Add funds to your wallet before withdrawing (min $1).</Text>
            ) : statusLoading ? (
              <Text style={styles.hint}>Verifying your Stripe payout status…</Text>
            ) : !withdrawReady ? (
              <Text style={styles.hint}>
                {statusStale
                  ? 'Refresh (pull down) after you are back online.'
                  : 'If you are stuck, open the Stripe dashboard from above — Stripe may need extra verification.'}
              </Text>
            ) : (
              <Text style={styles.hint}>We check your balance and Stripe payout status before each transfer.</Text>
            )}
          </LinearGradient>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
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
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.35)',
    marginBottom: 14,
  },
  head: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  body: { color: 'rgba(226,232,240,0.9)', fontSize: 14, lineHeight: 21, marginBottom: 14 },
  em: { fontWeight: '800', color: '#f8fafc' },
  prefillHead: { color: '#fde68a', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingRight: 8 },
  bullet: { color: 'rgba(148,163,184,0.9)', fontSize: 14, lineHeight: 20 },
  bulletTxt: { flex: 1, color: 'rgba(203,213,225,0.92)', fontSize: 13, lineHeight: 20 },
  meta: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginBottom: 8, marginTop: 14 },
  statusLine: { color: '#fbbf24', fontSize: 13, fontWeight: '700', marginBottom: 14 },
  statusOk: { color: '#4ade80' },
  ctaOuter: { borderRadius: 12, overflow: 'hidden' },
  ctaGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  dashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
  },
  dashTxt: { color: runit.neonCyan, fontWeight: '800', fontSize: 14 },
  warn: { color: '#fbbf24', marginTop: 12, fontSize: 13 },
  legal: { color: 'rgba(148,163,184,0.75)', fontSize: 11, lineHeight: 16, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.45)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    backgroundColor: 'rgba(8,4,18,0.75)',
  },
  hint: { color: 'rgba(148,163,184,0.9)', fontSize: 12, marginTop: 10, lineHeight: 17 },
  timingNote: {
    color: 'rgba(203,213,225,0.95)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(14,165,233,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
  },
  callout: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.35)',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  calloutWarn: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  calloutTxt: { flex: 1, color: 'rgba(226,232,240,0.95)', fontSize: 13, lineHeight: 19 },
  inputMuted: { opacity: 0.55 },
});
