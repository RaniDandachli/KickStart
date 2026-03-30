import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShippingAddressForm } from '@/components/profile/ShippingAddressForm';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useShippingAddress } from '@/hooks/useShippingAddress';
import { queryKeys } from '@/lib/queryKeys';
import { emptyShippingAddress, isShippingAddressComplete } from '@/lib/shippingAddress';
import type { PrizeCatalogRow } from '@/types/database';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';
import { usePrizeCatalog } from '@/hooks/usePrizeCatalog';
import { useRedeemTicketsDisplay } from '@/hooks/useRedeemTicketsDisplay';
import { useDemoRedeemTicketsStore } from '@/store/demoRedeemTicketsStore';
import { getSupabase } from '@/supabase/client';
import { topUpComingSoonMessage } from '@/lib/purchaseEconomy';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowPink } from '@/lib/runitArcadeTheme';

type ShippingModal =
  | null
  | { kind: 'catalog'; prize: PrizeCatalogRow }
  | { kind: 'demo' };

export default function PrizesScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const accountEmail = useAuthStore((s) => s.user?.email);
  const qc = useQueryClient();
  const profileQ = useProfile(uid);
  const catalogQ = usePrizeCatalog();
  const redeemTickets = useRedeemTicketsDisplay();
  const trySpendDemoTickets = useDemoRedeemTicketsStore((s) => s.trySpend);
  const { address, save, complete: shippingComplete } = useShippingAddress();
  const [shippingModal, setShippingModal] = useState<ShippingModal>(null);
  const [draft, setDraft] = useState(emptyShippingAddress);

  useEffect(() => {
    if (shippingModal) setDraft(address);
  }, [shippingModal, address]);

  const redeem = useMutation({
    mutationFn: async (vars: { prizeId: string; requiresShipping: boolean }) => {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('redeem_prize_offer', { p_prize_id: vars.prizeId });
      if (error) throw error;
      const row = data as { ok?: boolean; error?: string };
      if (!row?.ok) throw new Error(row?.error ?? 'redeem_failed');
    },
    onSuccess: (_, vars) => {
      if (uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      setShippingModal(null);
      const body = vars.requiresShipping
        ? 'We will ship to the address on your profile. You will get a confirmation email when it ships.'
        : 'Digital codes and gift cards are sent to your sign-up email — check inbox and spam.';
      Alert.alert('Redeemed!', body);
    },
    onError: (e: Error) => {
      const msg = e.message ?? '';
      if (msg.includes('shipping_required')) {
        Alert.alert('Shipping address required', 'Add your full shipping address to redeem this physical prize.');
        return;
      }
      Alert.alert('Could not redeem', msg);
    },
  });

  const saveDraftAndRedeemCatalog = useCallback(
    async (p: PrizeCatalogRow) => {
      if (!isShippingAddressComplete(draft)) {
        Alert.alert('Incomplete address', 'Fill in name, street, city, postal code, and country.');
        return;
      }
      await save(draft);
      if (uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      redeem.mutate({ prizeId: p.id, requiresShipping: p.requires_shipping });
    },
    [draft, save, uid, qc, redeem],
  );

  const saveDraftAndRedeemDemo = useCallback(async () => {
    if (!isShippingAddressComplete(draft)) {
      Alert.alert('Incomplete address', 'Fill in name, street, city, postal code, and country.');
      return;
    }
    await save(draft);
    if (!trySpendDemoTickets(3)) {
      Alert.alert('Not enough tickets', 'Win arcade prize runs to earn redeem tickets.');
      return;
    }
    setShippingModal(null);
    Alert.alert('Redeemed! (demo)', 'We would queue this for fulfillment with your saved address.');
  }, [draft, save, trySpendDemoTickets]);

  const startRedeemCatalog = useCallback(
    (p: PrizeCatalogRow) => {
      if (!uid) {
        Alert.alert('Sign in', 'Create an account to redeem prizes.');
        return;
      }
      if (p.requires_shipping && !shippingComplete) {
        setShippingModal({ kind: 'catalog', prize: p });
        return;
      }
      Alert.alert('Redeem prize?', `Spend ${p.cost_redeem_tickets} redeem tickets for "${p.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Redeem', onPress: () => redeem.mutate({ prizeId: p.id, requiresShipping: p.requires_shipping }) },
      ]);
    },
    [uid, shippingComplete, redeem],
  );

  const startRedeemDemo = useCallback(() => {
    if (!shippingComplete) {
      setShippingModal({ kind: 'demo' });
      return;
    }
    if (!trySpendDemoTickets(3)) {
      Alert.alert('Not enough tickets', 'Win arcade prize runs to earn redeem tickets.');
      return;
    }
    Alert.alert('Redeemed! (demo)', 'Your prize would be queued for fulfillment with a live backend.');
  }, [shippingComplete, trySpendDemoTickets]);

  return (
    <Screen>
      <Text style={[styles.pageTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>PRIZES</Text>
      <Text style={styles.pageSub}>Spend redeem tickets here — earn them from arcade prize runs</Text>

      <Pressable onPress={() => router.push('/(app)/(tabs)/profile/shipping-address')} style={styles.shipLink}>
        <View style={styles.iconLine}>
          <Ionicons name="cube-outline" size={16} color={runit.neonCyan} accessibilityIgnoresInvertColors />
          <Text style={styles.shipLinkText}>Shipping address for physical prizes →</Text>
        </View>
      </Pressable>
      <View style={styles.digitalLine}>
        <View style={styles.iconLine}>
          <Ionicons name="mail-outline" size={15} color="rgba(203,213,225,0.88)" accessibilityIgnoresInvertColors />
          <Text style={styles.digitalLineText}>
            Digital gift cards & codes go to your login email
            {accountEmail ? `: ${accountEmail}` : ' (shown when signed in).'}
          </Text>
        </View>
      </View>
      <Pressable onPress={() => Alert.alert('Buy credits & tickets', topUpComingSoonMessage())} style={styles.shipLink}>
        <View style={styles.iconLine}>
          <Ionicons name="card-outline" size={16} color={runit.neonCyan} accessibilityIgnoresInvertColors />
          <Text style={styles.shipLinkText}>Buy credits & tickets (pricing) →</Text>
        </View>
      </Pressable>

      {/* Balance badge */}
      <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.balanceOuter, runitGlowPinkSoft]}>
        <View style={styles.balanceInner}>
          <Text style={styles.balanceLbl}>YOUR REDEEM TICKETS</Text>
          <Text style={[styles.balanceVal, { fontFamily: runitFont.black }]}>
            {ENABLE_BACKEND && profileQ.isLoading ? '…' : redeemTickets.toLocaleString()}
          </Text>
          {!ENABLE_BACKEND ? (
            <Text style={styles.balanceHint}>Demo balance — prize credits are for playing; tickets are for this shop</Text>
          ) : null}
        </View>
      </LinearGradient>

      {!ENABLE_BACKEND ? (
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="folder-open-outline" size={14} color={runit.neonCyan} accessibilityIgnoresInvertColors />
            <Text style={styles.infoTitle}>CATALOG</Text>
          </View>
          <Text style={styles.infoBody}>
            Add rows in Supabase → Table Editor → prize_catalog. Set requires_shipping for items that ship. Paste the public
            Storage URL into image_url.
          </Text>
        </View>
      ) : null}

      {catalogQ.isLoading && (
        <>
          <SkeletonBlock className="mb-3 h-36 w-full rounded-2xl" />
          <SkeletonBlock className="mb-3 h-36 w-full rounded-2xl" />
        </>
      )}

      {catalogQ.error && (
        <EmptyState title="Could not load prizes" description={(catalogQ.error as Error).message} />
      )}

      {ENABLE_BACKEND && !catalogQ.isLoading && !catalogQ.data?.length ? (
        <EmptyState title="No prizes yet" description="Add items in Supabase → prize_catalog." />
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false}>
        {catalogQ.data?.map((p) => (
          <View key={p.id} style={styles.prizeCard}>
            {p.image_url ? <Image source={{ uri: p.image_url }} style={styles.prizeImg} resizeMode="cover" /> : null}
            <View style={styles.prizeMeta}>
              <Text style={[styles.prizeTitle, { fontFamily: runitFont.bold }]}>{p.title}</Text>
              {p.description ? <Text style={styles.prizeDesc}>{p.description}</Text> : null}
              <View style={styles.prizeRow}>
                <View style={styles.prizeCostRow}>
                  <Ionicons name="ticket-outline" size={15} color={runit.neonCyan} accessibilityIgnoresInvertColors />
                  <Text style={styles.prizeCost}>{p.cost_redeem_tickets.toLocaleString()} tickets</Text>
                </View>
                {p.requires_shipping ? <Text style={styles.prizeShip}>Physical · ships to you</Text> : null}
                {p.stock_remaining != null ? <Text style={styles.prizeStock}>Stock: {p.stock_remaining}</Text> : null}
              </View>
              <AppButton
                className="mt-2"
                title={p.cost_redeem_tickets > redeemTickets ? 'Not enough tickets' : 'Redeem'}
                disabled={p.cost_redeem_tickets > redeemTickets || redeem.isPending}
                loading={redeem.isPending}
                onPress={() => startRedeemCatalog(p)}
              />
            </View>
          </View>
        ))}

        {!ENABLE_BACKEND ? (
          <View style={styles.prizeCard}>
            <View style={styles.prizeMeta}>
              <Text style={[styles.prizeTitle, { fontFamily: runitFont.bold }]}>Sample physical (demo)</Text>
              <Text style={styles.prizeDesc}>
                Example of a ship-to-you prize — we ask for your address before redeeming if it is not saved yet.
              </Text>
              <View style={styles.prizeRow}>
                <View style={styles.prizeCostRow}>
                  <Ionicons name="ticket-outline" size={15} color={runit.neonCyan} accessibilityIgnoresInvertColors />
                  <Text style={styles.prizeCost}>3 tickets</Text>
                </View>
                <Text style={styles.prizeShip}>Physical · ships to you</Text>
              </View>
              <AppButton
                className="mt-2"
                title={redeemTickets < 3 ? 'Not enough tickets' : 'Redeem (demo)'}
                disabled={redeemTickets < 3}
                onPress={startRedeemDemo}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Pressable onPress={() => router.push('/(app)/(tabs)/play')} style={styles.earnLink}>
        <View style={styles.iconLine}>
          <Ionicons name="flash-outline" size={17} color={runit.neonCyan} accessibilityIgnoresInvertColors />
          <Text style={styles.earnLinkText}>Earn more in Arcade →</Text>
        </View>
      </Pressable>

      <Modal visible={shippingModal != null} animationType="slide" transparent onRequestClose={() => setShippingModal(null)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.modalSafe} edges={['bottom']}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Shipping address</Text>
              <Text style={styles.modalSub}>
                {shippingModal?.kind === 'catalog'
                  ? `Required for "${shippingModal.prize.title}".`
                  : 'Required for this physical demo prize.'}
              </Text>
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.modalScroll}>
                <ShippingAddressForm value={draft} onChange={setDraft} />
              </ScrollView>
              <AppButton
                title={shippingModal?.kind === 'catalog' ? 'Save & redeem' : 'Save & redeem (demo)'}
                loading={redeem.isPending}
                disabled={redeem.isPending}
                onPress={() => {
                  if (shippingModal?.kind === 'catalog') void saveDraftAndRedeemCatalog(shippingModal.prize);
                  else void saveDraftAndRedeemDemo();
                }}
              />
              <AppButton className="mt-2" title="Cancel" variant="ghost" onPress={() => setShippingModal(null)} />
              <Pressable onPress={() => router.push('/(app)/(tabs)/profile/shipping-address')} style={styles.modalSettings}>
                <Text style={styles.modalSettingsText}>Open full shipping settings →</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: { color: runit.neonPink, fontSize: 30, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
  pageSub: { color: 'rgba(203,213,225,0.9)', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  shipLink: { marginBottom: 8 },
  shipLinkText: { color: runit.neonCyan, fontSize: 13, fontWeight: '700', flex: 1 },
  iconLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  digitalLine: {
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  digitalLineText: {
    color: 'rgba(203,213,225,0.88)',
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  balanceOuter: { borderRadius: 16, padding: 2, marginBottom: 16 },
  balanceInner: {
    backgroundColor: 'rgba(6,2,14,0.7)',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  balanceLbl: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  balanceVal: { color: '#fff', fontSize: 38, fontWeight: '900', textShadowColor: runit.neonPink, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  balanceHint: { color: 'rgba(148,163,184,0.85)', fontSize: 11, marginTop: 6 },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.4)',
    backgroundColor: 'rgba(12,6,22,0.85)',
    padding: 14,
    marginBottom: 14,
  },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  infoTitle: { color: runit.neonCyan, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  infoBody: { color: 'rgba(203,213,225,0.85)', fontSize: 13, lineHeight: 18 },
  prizeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.4)',
    backgroundColor: 'rgba(12,6,22,0.85)',
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: 'rgba(157,78,237,0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
  },
  prizeImg: { width: '100%', height: 160 },
  prizeMeta: { padding: 14 },
  prizeTitle: { color: '#fff', fontSize: 17, fontWeight: '900', marginBottom: 4 },
  prizeDesc: { color: 'rgba(203,213,225,0.85)', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  prizeCostRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  prizeCost: { color: runit.neonCyan, fontSize: 14, fontWeight: '800' },
  prizeShip: { color: '#FDE047', fontSize: 12, fontWeight: '700' },
  prizeStock: { color: 'rgba(148,163,184,0.9)', fontSize: 12 },
  earnLink: { paddingVertical: 12, alignItems: 'center' },
  earnLinkText: { color: runit.neonCyan, fontSize: 14, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSafe: { maxHeight: '92%' },
  modalCard: {
    backgroundColor: 'rgba(12,6,22,0.98)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.45)',
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 4 },
  modalSub: { color: 'rgba(148,163,184,0.95)', fontSize: 13, marginBottom: 12 },
  modalScroll: { maxHeight: 360, marginBottom: 12 },
  modalSettings: { alignItems: 'center', paddingTop: 8 },
  modalSettingsText: { color: runit.neonCyan, fontSize: 13, fontWeight: '700' },
});
