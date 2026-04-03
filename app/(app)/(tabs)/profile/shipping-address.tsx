import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ShippingAddressForm } from '@/components/profile/ShippingAddressForm';
import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useShippingAddress } from '@/hooks/useShippingAddress';
import { ROUTES, safeBack } from '@/lib/appNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { emptyShippingAddress, isShippingAddressComplete } from '@/lib/shippingAddress';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';

export default function ShippingAddressScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useAuthStore((s) => s.user?.id);
  const { address, save, isLoadingProfile } = useShippingAddress();
  const [draft, setDraft] = useState(emptyShippingAddress);

  const addressFingerprint = JSON.stringify(address);

  useEffect(() => {
    setDraft(address);
  }, [addressFingerprint]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (ENABLE_BACKEND && !uid) throw new Error('Sign in to save');
      await save(draft);
    },
    onSuccess: () => {
      if (uid) void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      Alert.alert('Saved', 'Shipping address updated.');
    },
    onError: (e: Error) => Alert.alert('Could not save', e.message),
  });

  const canSave = isShippingAddressComplete(draft);

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => safeBack(router, ROUTES.profileTab)} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color="#e2e8f0" />
        </Pressable>
        <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>SHIPPING</Text>
        <View style={styles.backSpacer} />
      </View>
      <Text style={styles.sub}>
        For physical prizes only. Digital rewards use your account email — add it in your profile if needed.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {ENABLE_BACKEND && !uid ? (
          <Text style={styles.warn}>Sign in to save a shipping address to your account.</Text>
        ) : null}
        {isLoadingProfile ? <Text style={styles.muted}>Loading…</Text> : null}
        <ShippingAddressForm value={draft} onChange={setDraft} />
        <AppButton
          className="mt-6"
          title="Save address"
          loading={saveMut.isPending}
          disabled={!canSave || saveMut.isPending || (ENABLE_BACKEND && !uid)}
          onPress={() => saveMut.mutate()}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backSpacer: { width: 44 },
  title: { color: runit.neonPink, fontSize: 22, letterSpacing: 2 },
  sub: {
    color: 'rgba(203,213,225,0.9)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  muted: { color: 'rgba(148,163,184,0.9)', marginBottom: 12 },
  warn: { color: '#fbbf24', marginBottom: 12, fontSize: 14 },
});
