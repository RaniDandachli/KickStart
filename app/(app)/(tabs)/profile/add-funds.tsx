import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';

import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND, WALLET_TOPUP_STRIPE_ENABLED } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { ROUTES, safeBack } from '@/lib/appNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan } from '@/lib/runitArcadeTheme';
import { assertValidTopUpAmountCents, completeWalletTopUp } from '@/services/wallet/completeTopUp';
import { useAuthStore } from '@/store/authStore';

function goBackFromAddFunds(router: ReturnType<typeof useRouter>) {
  safeBack(router, ROUTES.profileTab);
}

/** Official Stripe guide — wire Checkout / Payment Element + server webhook before enabling live top-up. */
const STRIPE_ACCEPT_PAYMENT_URL = 'https://stripe.com/docs/payments/accept-a-payment';

const PRESETS_CENTS = [500, 1000, 2500, 5000] as const;

type Step = 'amount' | 'payment';

export default function AddFundsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const walletCents = useWalletDisplayCents();
  const [step, setStep] = useState<Step>('amount');
  const [selectedCents, setSelectedCents] = useState<number>(1000);
  const [customDollars, setCustomDollars] = useState('');

  const amountCents = useMemo(() => {
    if (customDollars.trim() !== '') {
      const n = Number.parseFloat(customDollars.replace(/[^0-9.]/g, ''));
      if (!Number.isFinite(n) || n <= 0) return selectedCents;
      return Math.round(n * 100);
    }
    return selectedCents;
  }, [customDollars, selectedCents]);

  const topUp = useMutation({
    mutationFn: async () => completeWalletTopUp(amountCents),
    onSuccess: () => {
      if (ENABLE_BACKEND && uid) {
        void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      }
      Alert.alert('Wallet updated', `${formatUsdFromCents(amountCents)} added to your wallet.`, [
        { text: 'OK', onPress: () => goBackFromAddFunds(router) },
      ]);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Could not add funds';
      Alert.alert('Add funds', msg);
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

  const openStripeDocs = useCallback(() => {
    void WebBrowser.openBrowserAsync(STRIPE_ACCEPT_PAYMENT_URL);
  }, []);

  const backendPending = ENABLE_BACKEND && !WALLET_TOPUP_STRIPE_ENABLED;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => (step === 'payment' ? setStep('amount') : goBackFromAddFunds(router))} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={runit.neonCyan} />
          <Text style={styles.backLbl}>{step === 'payment' ? 'Amount' : 'Back'}</Text>
        </Pressable>
        <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowCyan]}>ADD FUNDS</Text>
        <View style={styles.topSpacer} />
      </View>

      <LinearGradient colors={[runit.neonPurple, runit.neonPink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.balanceOuter, runitGlowPinkSoft]}>
        <View style={styles.balanceInner}>
          <Text style={styles.balanceLbl}>Current balance</Text>
          <Text style={styles.balanceVal}>{formatUsdFromCents(walletCents)}</Text>
          {profileQ.isLoading ? null : (
            <Text style={styles.balanceMeta}>
              {ENABLE_BACKEND ? 'Cash wallet — used for entry fees & tournaments' : 'Demo wallet — simulates a funded account'}
            </Text>
          )}
        </View>
      </LinearGradient>

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
            onChangeText={(t) => setCustomDollars(t)}
          />
          <Text style={styles.hint}>You will confirm card details on the next step. Processing will use Stripe.</Text>
          <Pressable
            onPress={() => void onContinueToPayment()}
            style={({ pressed }) => [styles.ctaOuter, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient colors={['#0369a1', '#0ea5e9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
              <Text style={styles.ctaTxt}>Continue to payment</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.payHead}>Payment</Text>
          <Text style={styles.paySub}>Adding {formatUsdFromCents(amountCents)} to your wallet</Text>

          {backendPending ? (
            <View style={styles.banner}>
              <Ionicons name="information-circle" size={20} color="#FDE047" />
              <Text style={styles.bannerTxt}>
                Card payments are not connected yet. Enable Stripe on the server, then set WALLET_TOPUP_STRIPE_ENABLED.
              </Text>
            </View>
          ) : null}

          <View style={styles.fakeCard}>
            <Text style={styles.fakeLbl}>Card number</Text>
            <TextInput
              style={styles.fakeInput}
              editable={false}
              placeholder="4242 4242 4242 4242"
              placeholderTextColor="rgba(148,163,184,0.35)"
            />
            <View style={styles.fakeRow}>
              <View style={styles.fakeHalf}>
                <Text style={styles.fakeLbl}>Expiry</Text>
                <TextInput style={styles.fakeInput} editable={false} placeholder="MM / YY" placeholderTextColor="rgba(148,163,184,0.35)" />
              </View>
              <View style={styles.fakeHalf}>
                <Text style={styles.fakeLbl}>CVC</Text>
                <TextInput style={styles.fakeInput} editable={false} placeholder="•••" placeholderTextColor="rgba(148,163,184,0.35)" />
              </View>
            </View>
            <Text style={styles.stripeNote}>
              Card details will be collected securely by Stripe (Checkout or Payment Element). Do not type real card numbers here — this screen is a layout preview until Stripe is wired.
            </Text>
          </View>

          <Pressable onPress={() => void openStripeDocs()} style={styles.docLink}>
            <Text style={styles.docLinkTxt}>Stripe: accept a payment →</Text>
          </Pressable>

          <Pressable
            onPress={() => topUp.mutate()}
            disabled={topUp.isPending}
            style={({ pressed }) => [styles.ctaOuter, pressed && !topUp.isPending && { opacity: 0.92 }]}
          >
            <LinearGradient colors={['#ff006e', '#9d4edd']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
              {topUp.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={22} color="#fff" />
                  <Text style={styles.ctaTxt}>
                    {backendPending ? 'Complete setup to pay' : 'Pay & add to wallet'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </>
      )}
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
  balanceOuter: { borderRadius: 16, padding: 2, marginBottom: 22 },
  balanceInner: {
    borderRadius: 14,
    backgroundColor: 'rgba(6,2,14,0.78)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  balanceLbl: { color: 'rgba(148,163,184,0.9)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  balanceVal: { color: runit.neonCyan, fontSize: 28, fontWeight: '900', marginTop: 4 },
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
  ctaOuter: { borderRadius: 14, overflow: 'hidden' },
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
  bannerTxt: { flex: 1, color: 'rgba(254,243,199,0.95)', fontSize: 13, lineHeight: 18 },
  fakeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.4)',
    backgroundColor: 'rgba(8,4,18,0.72)',
    padding: 14,
    marginBottom: 12,
  },
  fakeLbl: { color: 'rgba(148,163,184,0.85)', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  fakeInput: {
    borderWidth: 1,
    borderColor: 'rgba(100,100,120,0.5)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: 'rgba(148,163,184,0.5)',
    fontSize: 15,
    marginBottom: 12,
  },
  fakeRow: { flexDirection: 'row', gap: 12 },
  fakeHalf: { flex: 1 },
  stripeNote: { color: 'rgba(148,163,184,0.8)', fontSize: 11, lineHeight: 16, marginTop: 4 },
  docLink: { marginBottom: 16 },
  docLinkTxt: { color: runit.neonCyan, fontWeight: '700', fontSize: 13 },
});
