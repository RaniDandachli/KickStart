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
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
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
import type { PrizeCatalogWithReward } from '@/types/database';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';
import { usePrizeCatalog } from '@/hooks/usePrizeCatalog';
import { useRedeemTicketsDisplay } from '@/hooks/useRedeemTicketsDisplay';
import { useDemoRedeemTicketsStore } from '@/store/demoRedeemTicketsStore';
import { getSupabase } from '@/supabase/client';
import { pushCrossTab } from '@/lib/appNavigation';
import { redeemGiftCard } from '@/services/redeemGiftCard';
import { getNextRewardTarget } from '@/lib/nextRewardProgress';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowPink } from '@/lib/runitArcadeTheme';

type ShippingModal =
  | null
  | { kind: 'catalog'; prize: PrizeCatalogWithReward }
  | { kind: 'guest_sample' };

function isGiftCardPrize(p: PrizeCatalogWithReward): boolean {
  return !!p.reward_catalog?.reward_key;
}

function newIdempotencyKey(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

const SCREEN_H_PAD = 16;
const CATALOG_GAP = 8;
/** Match Arcade “compact” rows — smaller tiles so more catalog items fit above the fold. */
const PRIZE_IMG_H = 58;

export default function PrizesScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const catalogCols = windowWidth >= 540 ? 3 : 2;
  const catalogTileW = Math.max(
    108,
    Math.floor(
      (windowWidth - SCREEN_H_PAD * 2 - CATALOG_GAP * (catalogCols - 1)) / catalogCols,
    ),
  );

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
  const [redeemingGiftId, setRedeemingGiftId] = useState<string | null>(null);

  const addressFingerprint = JSON.stringify(address);

  useEffect(() => {
    if (shippingModal) setDraft(address);
  }, [shippingModal, addressFingerprint]);

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
    async (p: PrizeCatalogWithReward) => {
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
    Alert.alert('Redeemed (preview)', 'Saved on this device only — sign in with the live catalog for real fulfillment.');
  }, [draft, save, trySpendDemoTickets]);

  const startRedeemCatalog = useCallback(
    (p: PrizeCatalogWithReward) => {
      if (!uid) {
        Alert.alert('Sign in', 'Create an account to redeem prizes.');
        return;
      }
      if (isGiftCardPrize(p)) {
        const rk = p.reward_catalog?.reward_key;
        if (!rk) return;
        Alert.alert(
          'Redeem gift card?',
          `Spend ${p.cost_redeem_tickets.toLocaleString()} redeem tickets for "${p.title}"? Your code will be emailed to your login address.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Redeem',
              onPress: () => {
                void (async () => {
                  setRedeemingGiftId(p.id);
                  try {
                    const res = await redeemGiftCard({
                      rewardKey: rk,
                      idempotencyKey: newIdempotencyKey(),
                    });
                    Alert.alert(
                      res.partial ? 'Redemption recorded' : 'Success',
                      res.message ?? 'Your gift card has been sent to your email.',
                    );
                    if (uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
                  } catch (e) {
                    Alert.alert('Could not redeem', e instanceof Error ? e.message : 'Unknown error');
                  } finally {
                    setRedeemingGiftId(null);
                  }
                })();
              },
            },
          ],
        );
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
    [uid, shippingComplete, redeem, qc],
  );

  const nextReward = getNextRewardTarget(
    redeemTickets,
    catalogQ.data,
    !ENABLE_BACKEND ? { cost: 3, title: 'Sample physical prize' } : undefined,
  );

  const startRedeemDemo = useCallback(() => {
    if (!shippingComplete) {
      setShippingModal({ kind: 'guest_sample' });
      return;
    }
    if (!trySpendDemoTickets(3)) {
      Alert.alert('Not enough tickets', 'Win arcade prize runs to earn redeem tickets.');
      return;
    }
    Alert.alert('Redeemed (preview)', 'Guest mode — this device only. Sign in with Supabase for real redemptions.');
  }, [shippingComplete, trySpendDemoTickets]);

  return (
    <Screen>
      <Text style={[styles.pageTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>PRIZES</Text>
      <Text style={styles.pageSub}>Spend redeem tickets here — earn them from arcade prize runs</Text>

      <Pressable onPress={() => pushCrossTab(router, '/(app)/(tabs)/profile/shipping-address')} style={styles.shipLink}>
        <View style={styles.iconLine}>
          <SafeIonicons name="cube-outline" size={16} color={runit.neonCyan} accessibilityIgnoresInvertColors />
          <Text style={styles.shipLinkText}>Shipping address for physical prizes →</Text>
        </View>
      </Pressable>
      <View style={styles.digitalLine}>
        <View style={styles.iconLine}>
          <SafeIonicons name="mail-outline" size={15} color="rgba(203,213,225,0.88)" accessibilityIgnoresInvertColors />
          <Text style={styles.digitalLineText}>
            Digital gift cards & codes go to your login email
            {accountEmail ? `: ${accountEmail}` : ' (shown when signed in).'}
          </Text>
        </View>
      </View>
      <Pressable onPress={() => pushCrossTab(router, '/(app)/(tabs)/profile/add-funds')} style={styles.shipLink}>
        <View style={styles.iconLine}>
          <SafeIonicons name="card-outline" size={16} color={runit.neonCyan} accessibilityIgnoresInvertColors />
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
          {nextReward && !(ENABLE_BACKEND && catalogQ.isLoading) ? (
            <View
              style={styles.progressBlock}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: nextReward.percent }}
            >
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={[runit.neonCyan, runit.neonPink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${Math.min(100, nextReward.percent)}%` }]}
                />
              </View>
              <Text style={styles.progressHeadline} numberOfLines={2}>
                🔥 {nextReward.percent}% to {nextReward.title}
              </Text>
              {nextReward.allAffordable ? (
                <Text style={styles.progressSub}>You can redeem every prize — pick one below</Text>
              ) : nextReward.ticketsToGo > 0 ? (
                <Text style={styles.progressSub}>Only {nextReward.ticketsToGo.toLocaleString()} tickets to go</Text>
              ) : (
                <Text style={styles.progressSub}>Ready to redeem — tap below</Text>
              )}
            </View>
          ) : null}
          {!ENABLE_BACKEND ? (
            <Text style={styles.balanceHint}>
              Guest mode — Arcade Credits are for playing; redeem tickets are for this preview catalog
            </Text>
          ) : null}
        </View>
      </LinearGradient>

      {!ENABLE_BACKEND ? (
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <SafeIonicons name="folder-open-outline" size={14} color={runit.neonCyan} accessibilityIgnoresInvertColors />
            <Text style={styles.infoTitle}>CATALOG</Text>
          </View>
          <Text style={styles.infoBody}>
            Add rows in Supabase → Table Editor → prize_catalog. Set requires_shipping for items that ship. Paste the public
            Storage URL into image_url.
          </Text>
        </View>
      ) : null}

      {catalogQ.error && (
        <EmptyState title="Could not load prizes" description={(catalogQ.error as Error).message} />
      )}

      {ENABLE_BACKEND && !catalogQ.isLoading && !catalogQ.data?.length ? (
        <EmptyState title="No prizes yet" description="Add items in Supabase → prize_catalog." />
      ) : null}

      {!catalogQ.error &&
      (catalogQ.isLoading || (catalogQ.data?.length ?? 0) > 0 || !ENABLE_BACKEND) ? (
        <>
          <Text style={styles.catalogHeading}>Catalog</Text>
          <View style={styles.catalogGrid}>
            {catalogQ.isLoading
              ? [0, 1, 2, 3, 4, 5].map((k) => (
                  <View key={k} style={{ width: catalogTileW }}>
                    <SkeletonBlock className="h-36 w-full rounded-lg" />
                  </View>
                ))
              : null}
            {!catalogQ.isLoading &&
              catalogQ.data?.map((p) => {
          const short = p.cost_redeem_tickets > redeemTickets;
          const isGift = isGiftCardPrize(p);
          const giftBusy = redeemingGiftId === p.id;
          const disabled = short || giftBusy || (!isGift && redeem.isPending);
          const redeemLabel = short
            ? 'Need tickets'
            : giftBusy || (!isGift && redeem.isPending)
              ? '…'
              : 'Redeem';
          return (
            <View key={p.id} style={[styles.prizeCard, { width: catalogTileW }]}>
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={[styles.prizeImg, { height: PRIZE_IMG_H }]} resizeMode="cover" />
              ) : (
                <View style={[styles.prizeImgPlaceholder, { height: PRIZE_IMG_H }]} />
              )}
              <View style={styles.prizeMeta}>
                <Text style={[styles.prizeTitle, { fontFamily: runitFont.bold }]} numberOfLines={2}>
                  {p.title}
                </Text>
                {p.description ? (
                  <Text style={styles.prizeDesc} numberOfLines={2}>
                    {p.description}
                  </Text>
                ) : null}
                <View style={styles.prizeRow}>
                  <View style={styles.prizeCostRow}>
                    <SafeIonicons name="ticket-outline" size={12} color={runit.neonCyan} accessibilityIgnoresInvertColors />
                    <Text style={styles.prizeCost}>{p.cost_redeem_tickets.toLocaleString()}</Text>
                  </View>
                </View>
                <Text style={styles.prizeMetaLine} numberOfLines={1}>
                  {p.requires_shipping
                    ? 'Physical · ships to you'
                    : p.stock_remaining != null
                      ? `Stock ${p.stock_remaining}`
                      : 'Digital'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => startRedeemCatalog(p)}
                  style={({ pressed }) => [
                    styles.tileRedeemOuter,
                    disabled && styles.tileRedeemOuterDisabled,
                    pressed && !disabled && styles.tileRedeemPressed,
                  ]}
                >
                  <LinearGradient
                    colors={disabled ? ['#444', '#2a2a2a'] : [runit.neonPink, runit.neonPurple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.tileRedeemGrad}
                  >
                    <Text style={styles.tileRedeemText}>{redeemLabel}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          );
              })}

        {!catalogQ.isLoading && !ENABLE_BACKEND ? (
          <View style={[styles.prizeCard, { width: catalogTileW }]}>
            <View style={[styles.prizeImgPlaceholder, { height: PRIZE_IMG_H }]} />
            <View style={styles.prizeMeta}>
              <Text style={[styles.prizeTitle, { fontFamily: runitFont.bold }]} numberOfLines={2}>
                Sample physical (preview)
              </Text>
              <Text style={styles.prizeDesc} numberOfLines={2}>
                Ship-to-you example — address required if not saved.
              </Text>
              <View style={styles.prizeRow}>
                <View style={styles.prizeCostRow}>
                  <SafeIonicons name="ticket-outline" size={12} color={runit.neonCyan} accessibilityIgnoresInvertColors />
                  <Text style={styles.prizeCost}>3</Text>
                </View>
              </View>
              <Text style={styles.prizeMetaLine} numberOfLines={1}>
                Physical · ships to you
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={redeemTickets < 3}
                onPress={startRedeemDemo}
                style={({ pressed }) => [
                  styles.tileRedeemOuter,
                  redeemTickets < 3 && styles.tileRedeemOuterDisabled,
                  pressed && redeemTickets >= 3 && styles.tileRedeemPressed,
                ]}
              >
                <LinearGradient
                  colors={redeemTickets < 3 ? ['#444', '#2a2a2a'] : [runit.neonPink, runit.neonPurple]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tileRedeemGrad}
                >
                  <Text style={styles.tileRedeemText}>{redeemTickets < 3 ? 'Need tickets' : 'Redeem (preview)'}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        ) : null}
          </View>
        </>
      ) : null}

      <Pressable onPress={() => pushCrossTab(router, '/(app)/(tabs)/play')} style={styles.earnLink}>
        <View style={styles.iconLine}>
          <SafeIonicons name="flash-outline" size={17} color={runit.neonCyan} accessibilityIgnoresInvertColors />
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
                  : 'Required for this sample physical prize (preview).'}
              </Text>
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.modalScroll}>
                <ShippingAddressForm value={draft} onChange={setDraft} />
              </ScrollView>
              <AppButton
                title={shippingModal?.kind === 'catalog' ? 'Save & redeem' : 'Save & redeem (preview)'}
                loading={redeem.isPending}
                disabled={redeem.isPending}
                onPress={() => {
                  if (shippingModal?.kind === 'catalog') void saveDraftAndRedeemCatalog(shippingModal.prize);
                  else void saveDraftAndRedeemDemo();
                }}
              />
              <AppButton className="mt-2" title="Cancel" variant="ghost" onPress={() => setShippingModal(null)} />
              <Pressable onPress={() => pushCrossTab(router, '/(app)/(tabs)/profile/shipping-address')} style={styles.modalSettings}>
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
  pageTitle: { color: runit.neonPink, fontSize: 22, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
  pageSub: { color: 'rgba(203,213,225,0.9)', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  shipLink: { marginBottom: 6 },
  shipLinkText: { color: runit.neonCyan, fontSize: 13, fontWeight: '700', flex: 1 },
  iconLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  digitalLine: {
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  digitalLineText: {
    color: 'rgba(203,213,225,0.88)',
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  balanceOuter: { borderRadius: 14, padding: 2, marginBottom: 12 },
  balanceInner: {
    backgroundColor: 'rgba(6,2,14,0.7)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  balanceLbl: { color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: '800', letterSpacing: 1.8, marginBottom: 4 },
  balanceVal: { color: '#fff', fontSize: 28, fontWeight: '900', textShadowColor: runit.neonPink, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  progressBlock: { marginTop: 10, width: '100%', alignSelf: 'stretch' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', borderRadius: 5, minWidth: 0 },
  progressHeadline: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 17,
  },
  progressSub: { color: 'rgba(203,213,225,0.95)', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  balanceHint: { color: 'rgba(148,163,184,0.85)', fontSize: 10, marginTop: 4 },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.4)',
    backgroundColor: 'rgba(12,6,22,0.85)',
    padding: 12,
    marginBottom: 10,
  },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  infoTitle: { color: runit.neonCyan, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  infoBody: { color: 'rgba(203,213,225,0.85)', fontSize: 13, lineHeight: 18 },
  catalogHeading: {
    color: 'rgba(226,232,240,0.88)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 8,
    marginTop: 0,
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CATALOG_GAP,
    marginBottom: 4,
  },
  prizeCard: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.45)',
    backgroundColor: 'rgba(12,6,22,0.88)',
    overflow: 'hidden',
    shadowColor: 'rgba(157,78,237,0.22)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 3,
  },
  prizeImg: { width: '100%' },
  prizeImgPlaceholder: {
    width: '100%',
    backgroundColor: 'rgba(30,27,75,0.65)',
  },
  prizeMeta: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8 },
  prizeTitle: { color: '#fff', fontSize: 12, fontWeight: '900', marginBottom: 2, lineHeight: 15 },
  prizeDesc: { color: 'rgba(203,213,225,0.8)', fontSize: 9, marginBottom: 4, lineHeight: 12 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3, marginBottom: 1 },
  prizeCostRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  prizeCost: { color: runit.neonCyan, fontSize: 11, fontWeight: '800' },
  prizeMetaLine: { color: 'rgba(148,163,184,0.92)', fontSize: 8, fontWeight: '600', marginBottom: 6 },
  tileRedeemOuter: { borderRadius: 9, overflow: 'hidden' },
  tileRedeemOuterDisabled: { opacity: 0.55 },
  tileRedeemPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  tileRedeemGrad: {
    paddingVertical: 6,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tileRedeemText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  earnLink: { paddingVertical: 10, alignItems: 'center' },
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
