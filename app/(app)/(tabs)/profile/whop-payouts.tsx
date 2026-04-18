import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { ROUTES, safeBack } from '@/lib/appNavigation';
import { formatUsdFromCents } from '@/lib/money';
import {
  PAYOUT_BANK_TIMING_SHORT,
  PAYOUT_WHOP_TRANSFER_SUCCESS,
} from '@/lib/payoutCopy';
import { queryKeys } from '@/lib/queryKeys';
import { appBorderAccentMuted, runit, runitFont, runitTextGlowCyan } from '@/lib/runitArcadeTheme';
import { openWhopPayoutPortal } from '@/services/wallet/whopPayoutOnboarding';
import { withdrawWalletToWhop } from '@/services/wallet/withdrawWalletToWhop';
import { useAuthStore } from '@/store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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

export default function WhopPayoutsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const whopId = profileQ.data?.whop_company_id;
  const walletCents = useWalletDisplayCents();
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawUsd, setWithdrawUsd] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (uid && ENABLE_BACKEND) {
        void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      }
    }, [qc, uid]),
  );

  const onOpenPortal = useCallback(async () => {
    if (!ENABLE_BACKEND || !uid) {
      Alert.alert('Unavailable', 'Sign in with backend enabled to use Whop payouts.');
      return;
    }
    setBusy(true);
    try {
      await openWhopPayoutPortal();
      void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not open Whop';
      Alert.alert('Whop payouts', msg);
    } finally {
      setBusy(false);
    }
  }, [qc, uid]);

  const onWithdraw = useCallback(async () => {
    if (!uid || !ENABLE_BACKEND) return;
    if (!whopId) {
      Alert.alert(
        'Whop account required',
        'Open the Whop payout portal first so we can create your connected account.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open portal', onPress: () => void onOpenPortal() },
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
      Alert.alert('Sent to Whop', PAYOUT_WHOP_TRANSFER_SUCCESS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (/Open Whop payouts|connected account/i.test(msg)) {
        Alert.alert(
          'Finish setup',
          'Create your Whop connected account first — use “Open Whop payout portal” above.',
        );
        return;
      }
      if (/platform balance|top up|Whop platform/i.test(msg)) {
        Alert.alert(
          'Can’t complete transfer',
          'This often means the operator’s Whop platform balance is too low for this amount. Try a smaller amount later or contact support.',
        );
        return;
      }
      Alert.alert('Withdrawal failed', msg);
    } finally {
      setWithdrawing(false);
    }
  }, [uid, whopId, withdrawUsd, walletCents, qc, onOpenPortal]);

  const canEnterAmount = !withdrawing && walletCents >= 100;
  const canTapWithdraw = !withdrawing && walletCents >= 100 && !!whopId;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => safeBack(router, ROUTES.profileTab)} style={styles.backBtn} accessibilityRole="button">
            <SafeIonicons name="chevron-back" size={24} color={runit.neonCyan} />
            <Text style={styles.backLbl}>Back</Text>
          </Pressable>
          <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowCyan]}>WHOP</Text>
          <View style={styles.topSpacer} />
        </View>

        <LinearGradient colors={[runit.neonPurple, '#1e1b4b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <Text style={styles.badge}>Beta</Text>
          <Text style={styles.head}>Whop payouts</Text>
          <Text style={styles.body}>
            Connect a Whop company for your account and use their hosted page for KYC and bank details. This runs next to Stripe so you
            can compare rails.
          </Text>

          {whopId ? (
            <Text style={styles.meta}>
              Whop company: <Text style={styles.mono}>{whopId}</Text>
            </Text>
          ) : (
            <Text style={styles.meta}>No Whop company yet — tap below to create one and continue on Whop.</Text>
          )}

          <Text style={styles.emailNote}>
            Whop uses the email on your RunitArcade account. It must be a real inbox (e.g. Gmail) — test or placeholder addresses are
            rejected.
          </Text>

          <Pressable
            onPress={() => void onOpenPortal()}
            disabled={busy || !uid}
            style={({ pressed }) => [styles.ctaOuter, pressed && !busy && { opacity: 0.9 }]}
          >
            <LinearGradient colors={['#7c3aed', '#a855f7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>Open Whop payout portal</Text>}
            </LinearGradient>
          </Pressable>

          {!uid ? <Text style={styles.warn}>Sign in to continue.</Text> : null}
          {!ENABLE_BACKEND ? <Text style={styles.warn}>Backend disabled — enable EXPO_PUBLIC_ENABLE_BACKEND for Whop.</Text> : null}

          <Pressable onPress={() => router.push('/(app)/(tabs)/profile/stripe-connect')} style={styles.altLink}>
            <Text style={styles.altLinkTxt}>Use Stripe payouts instead →</Text>
          </Pressable>
        </LinearGradient>

        {ENABLE_BACKEND && uid ? (
          <LinearGradient colors={['#0f172a', '#1e1b4b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <Text style={styles.head}>Withdraw cash to Whop</Text>
            <Text style={styles.body}>
              Available: <Text style={styles.em}>{formatUsdFromCents(walletCents)}</Text>. Minimum $1.00. We debit your in-app wallet and
              transfer USD to your Whop connected company — then you move money to your bank from Whop&apos;s portal.
            </Text>
            <Text style={styles.timingNote}>{PAYOUT_BANK_TIMING_SHORT}</Text>

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
              <LinearGradient
                colors={!canTapWithdraw ? ['#334155', '#475569'] : ['#059669', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGrad}
              >
                {withdrawing ? (
                  <ActivityIndicator color="#fff" />
                ) : walletCents < 100 ? (
                  <Text style={styles.ctaTxt}>Need at least $1.00 to withdraw</Text>
                ) : !whopId ? (
                  <Text style={styles.ctaTxt}>Create Whop account first</Text>
                ) : (
                  <Text style={styles.ctaTxt}>Send to Whop connected account</Text>
                )}
              </LinearGradient>
            </Pressable>
            {walletCents < 100 ? (
              <Text style={styles.hint}>Add funds before withdrawing (min $1).</Text>
            ) : (
              <Text style={styles.hint}>
                Requires a funded Whop platform balance on our side. If this fails, try a smaller amount or finish verification in the Whop
                portal.
              </Text>
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
    borderColor: appBorderAccentMuted,
    marginBottom: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    color: 'rgba(250,250,250,0.9)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(168,85,247,0.35)',
  },
  head: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  body: { color: 'rgba(226,232,240,0.9)', fontSize: 14, lineHeight: 21, marginBottom: 12 },
  em: { color: runit.neonCyan, fontWeight: '900' },
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
  meta: { color: 'rgba(148,163,184,0.95)', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  emailNote: {
    color: 'rgba(251,191,36,0.95)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  mono: { fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0' },
  ctaOuter: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  ctaGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  ctaTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  warn: { color: '#fbbf24', fontSize: 13, marginBottom: 8 },
  altLink: { paddingVertical: 8 },
  altLinkTxt: { color: runit.neonCyan, fontWeight: '800', fontSize: 14 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    backgroundColor: 'rgba(8,4,18,0.75)',
  },
  inputMuted: { opacity: 0.55 },
  hint: { color: 'rgba(148,163,184,0.9)', fontSize: 12, marginTop: 4, lineHeight: 17 },
});
