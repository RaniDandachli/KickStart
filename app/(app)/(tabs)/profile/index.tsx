import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { ALLOW_GUEST_MODE, ENABLE_BACKEND } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useRedeemTicketsDisplay } from '@/hooks/useRedeemTicketsDisplay';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { pushCrossTab } from '@/lib/appNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import {
  normalizeUsername,
  updateProfileFields,
  uploadProfileAvatarFromUri,
  validateUsername,
} from '@/services/api/profiles';
import { useAuthStore } from '@/store/authStore';
import { getSupabase } from '@/supabase/client';

const LOCAL_PROFILE_KEY = '@kickclash/local_profile_v1';

type LocalProfile = {
  username: string;
  displayName: string;
  avatarUri: string | null;
};

const mockBadges = [
  { id: '1', name: 'Streak Starter', earned: true },
  { id: '2', name: 'Bracket Ready', earned: false },
];

const mockHistory = [
  { id: 'h1', label: 'Win vs NeoStriker', when: 'Yesterday', win: true },
  { id: 'h2', label: 'Loss vs GoalRush', when: '2d ago', win: false },
];

export default function ProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const uid = user?.id;
  const profileQ = useProfile(uid);
  const profile = profileQ.data;
  const loadingProfile = ENABLE_BACKEND && !!uid && profileQ.isLoading;
  const walletCentsDisplay = useWalletDisplayCents();
  const prizeCreditsDisplay = usePrizeCreditsDisplay();
  const redeemTicketsDisplay = useRedeemTicketsDisplay();

  const [draftUsername, setDraftUsername] = useState('');
  const [draftDisplay, setDraftDisplay] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const useServer = ENABLE_BACKEND && !!uid;

  useEffect(() => {
    if (useServer && profile) {
      setDraftUsername(profile.username ?? '');
      setDraftDisplay(profile.display_name ?? '');
      setAvatarUri(profile.avatar_url);
      return;
    }
    if (!useServer) {
      void AsyncStorage.getItem(LOCAL_PROFILE_KEY).then((raw) => {
        if (raw) {
          try {
            const p = JSON.parse(raw) as LocalProfile;
            setDraftUsername(p.username || 'player');
            setDraftDisplay(p.displayName || '');
            setAvatarUri(p.avatarUri);
          } catch {
            /* ignore */
          }
        } else {
          setDraftUsername('player');
          setDraftDisplay('');
          setAvatarUri(null);
        }
      });
    }
  }, [useServer, profile?.id, profile?.username, profile?.display_name, profile?.avatar_url]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error('Not signed in');
      const u = normalizeUsername(draftUsername);
      const err = validateUsername(u);
      if (err) throw new Error(err);
      await updateProfileFields(uid, {
        username: u,
        display_name: draftDisplay.trim() || null,
        avatar_url: avatarUri && avatarUri.startsWith('http') ? avatarUri : profile?.avatar_url ?? null,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.profile(uid!) });
      Alert.alert('Saved', 'Profile updated.');
    },
    onError: (e: unknown) => {
      const msg = String(e && typeof e === 'object' && 'message' in e ? (e as Error).message : e);
      const taken = /23505|duplicate key|unique constraint/i.test(msg);
      Alert.alert('Could not save', taken ? 'That username is taken' : msg);
    },
  });

  const pickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos', 'Allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;

    if (useServer && uid) {
      try {
        const url = await uploadProfileAvatarFromUri(uid, uri);
        setAvatarUri(url);
        await updateProfileFields(uid, { avatar_url: url });
        void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
        Alert.alert('Saved', 'Profile photo updated.');
      } catch (e) {
        Alert.alert(
          'Upload failed',
          e instanceof Error ? e.message : 'Could not upload. Create the `avatars` storage bucket (see supabase/migrations/00004_storage_avatars.sql) or try again.',
        );
      }
    } else {
      setAvatarUri(uri);
      await persistLocal(uri, draftUsername, draftDisplay);
      Alert.alert('Saved', 'Photo saved on this device (guest mode).');
    }
  }, [useServer, uid, draftUsername, draftDisplay, qc]);

  async function persistLocal(nextAvatar: string | null, u: string, d: string) {
    const payload: LocalProfile = {
      username: u,
      displayName: d,
      avatarUri: nextAvatar,
    };
    await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(payload));
  }

  async function saveText() {
    const u = normalizeUsername(draftUsername);
    const v = validateUsername(u);
    if (v) {
      Alert.alert('Username', v);
      return;
    }
    if (useServer && uid) {
      saveMutation.mutate();
      return;
    }
    await persistLocal(avatarUri, draftUsername, draftDisplay);
    Alert.alert('Saved', 'Profile saved on this device.');
  }

  async function clearAvatar() {
    if (useServer && uid) {
      try {
        await updateProfileFields(uid, { avatar_url: null });
        setAvatarUri(null);
        void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove photo');
      }
    } else {
      setAvatarUri(null);
      await persistLocal(null, draftUsername, draftDisplay);
    }
  }

  async function signOut() {
    try {
      const { resetArcadeGrantFlight } = await import('@/lib/arcadeGrants');
      resetArcadeGrantFlight();
      await getSupabase().auth.signOut();
    } catch {
      /* ignore */
    }
    useAuthStore.getState().signOutLocal();
    if (ENABLE_BACKEND) {
      router.replace('/(auth)/sign-in');
    } else {
      router.replace({ pathname: '/(auth)/welcome', params: { returning: '1' } });
    }
  }

  const showAvatar = avatarUri && (avatarUri.startsWith('http') || avatarUri.startsWith('file'));

  return (
    <Screen>
      {ALLOW_GUEST_MODE && !uid ? (
        <View style={styles.accountCallout}>
          <Text style={styles.accountCalloutTitle}>Sign in or create an account</Text>
          <Text style={styles.accountCalloutSub}>
            Use your Run It profile on this device. You can still try the arcade as a guest without signing in.
          </Text>
          <View style={styles.accountCalloutRow}>
            <Pressable
              style={({ pressed }) => [styles.accountCalloutBtn, pressed && { opacity: 0.9 }]}
              onPress={() => router.push('/(auth)/sign-in')}
            >
              <Text style={styles.accountCalloutBtnText}>Sign in</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.accountCalloutBtnSecondary, pressed && { opacity: 0.9 }]}
              onPress={() => router.push('/(auth)/sign-up')}
            >
              <Text style={styles.accountCalloutBtnSecondaryText}>Create account</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {ALLOW_GUEST_MODE && uid && user?.email ? (
        <Text style={styles.signedInNote}>Signed in as {user.email}</Text>
      ) : null}
      <View style={styles.header}>
        <Pressable onPress={() => void pickAvatar()} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              {showAvatar ? (
                <Image source={{ uri: avatarUri! }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={32} color="rgba(255,255,255,0.85)" />
              )}
            </View>
          </LinearGradient>
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color="#050208" />
          </View>
        </Pressable>

        <View style={styles.headerText}>
          {loadingProfile ? (
            <SkeletonBlock className="h-6 w-40" />
          ) : (
            <>
              <Text style={[styles.fieldLbl]}>Username</Text>
              <TextInput
                style={styles.input}
                value={draftUsername}
                onChangeText={(t) => setDraftUsername(normalizeUsername(t))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="your_name"
                placeholderTextColor="rgba(148,163,184,0.5)"
              />
              <Text style={[styles.fieldLbl, { marginTop: 8 }]}>Display name</Text>
              <TextInput
                style={styles.input}
                value={draftDisplay}
                onChangeText={setDraftDisplay}
                placeholder="Shown to friends"
                placeholderTextColor="rgba(148,163,184,0.5)"
              />
              <View style={styles.saveRow}>
                <Pressable
                  onPress={() => void saveText()}
                  disabled={saveMutation.isPending}
                  style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.88 }]}
                >
                  {saveMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save name</Text>
                  )}
                </Pressable>
                {showAvatar ? (
                  <Pressable onPress={() => void clearAvatar()} style={styles.clearPhoto}>
                    <Text style={styles.clearPhotoText}>Remove photo</Text>
                  </Pressable>
                ) : null}
              </View>
              {!useServer ? (
                <Text style={styles.hint}>Guest: saved on this device. Sign in with Supabase to sync.</Text>
              ) : null}
            </>
          )}
        </View>
      </View>

      {loadingProfile ? (
        <SkeletonBlock className="mb-4 h-36 w-full rounded-2xl" />
      ) : (
        <LinearGradient colors={[runit.neonPurple, runit.neonPink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.walletOuter, runitGlowPinkSoft]}>
          <View style={styles.walletInner}>
            <View style={styles.walletTitleRow}>
              <Ionicons name="wallet" size={20} color={runit.neonCyan} />
              <Text style={[styles.walletTitle, { fontFamily: runitFont.black }]}>WALLET</Text>
            </View>
            <Text style={styles.walletBalance}>{formatUsdFromCents(walletCentsDisplay)}</Text>
            <Text style={styles.walletSub}>
              {ENABLE_BACKEND ? 'Entry fees, tournaments and withdrawals' : 'Demo balance — updates when you win 1v1 matches'}
            </Text>
            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <Text style={styles.pillLbl}>WALLET</Text>
                <Text style={styles.pillVal}>{walletCentsDisplay.toLocaleString()}</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillLbl}>GEMS</Text>
                <Text style={styles.pillVal}>{(profile?.gems ?? 0).toLocaleString()}</Text>
              </View>
              <View style={[styles.pill, styles.pillWide]}>
                <Text style={styles.pillLbl}>PRIZE CR.</Text>
                <Text style={[styles.pillVal, { color: runit.neonCyan }]}>
                  {ENABLE_BACKEND ? (profile?.prize_credits ?? 0).toLocaleString() : prizeCreditsDisplay.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.pill, styles.pillWide]}>
                <Text style={styles.pillLbl}>TICKETS</Text>
                <Text style={[styles.pillVal, { color: '#FDE047' }]}>
                  {ENABLE_BACKEND ? (profile?.redeem_tickets ?? 0).toLocaleString() : redeemTicketsDisplay.toLocaleString()}
                </Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.addFundsBtn, pressed && { opacity: 0.88 }]}
              onPress={() => router.push('/(app)/(tabs)/profile/add-funds')}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.addFundsBtnText}>ADD FUNDS</Text>
            </Pressable>
            <View style={styles.walletBtns}>
              <Pressable style={({ pressed }) => [styles.wBtn, styles.wBtnPrimary, pressed && { opacity: 0.85 }]} onPress={() => pushCrossTab(router, '/(app)/(tabs)/play')}>
                <Ionicons name="game-controller-outline" size={16} color="#fff" />
                <Text style={styles.wBtnText}>PLAY</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.wBtn, styles.wBtnGhost, pressed && { opacity: 0.85 }]} onPress={() => router.push('/(app)/(tabs)/profile/transactions')}>
                <Ionicons name="arrow-down-circle-outline" size={16} color={runit.neonCyan} />
                <Text style={[styles.wBtnText, { color: runit.neonCyan }]}>WITHDRAW</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      )}

      <View style={styles.sectionLabel}>
        <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }, runitTextGlowCyan]}>STATS</Text>
        <View style={styles.sectionLine} />
      </View>
      <View style={styles.statsRow}>
        {[
          ['28', 'WINS', 'trophy'],
          ['#47', 'RANK', 'star'],
          ['12', 'STREAK', 'flame'],
        ].map(([val, lbl, ico]) => (
          <LinearGradient key={lbl} colors={[runit.neonPurple, runit.neonPink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statGrad}>
            <View style={styles.statInner}>
              <Ionicons name={ico as 'trophy' | 'star' | 'flame'} size={18} color="#fff" style={{ marginBottom: 4 }} />
              <Text style={[styles.statVal, { fontFamily: runitFont.black }]}>{val}</Text>
              <Text style={styles.statLbl}>{lbl}</Text>
            </View>
          </LinearGradient>
        ))}
      </View>

      <View style={styles.sectionLabel}>
        <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>RECENT MATCHES</Text>
        <View style={styles.sectionLine} />
      </View>
      {mockHistory.map((h) => (
        <View key={h.id} style={[styles.historyRow, { borderColor: h.win ? 'rgba(0,240,255,0.4)' : 'rgba(255,0,110,0.35)' }]}>
          <View style={[styles.historyDot, { backgroundColor: h.win ? runit.neonCyan : runit.neonPink }]} />
          <Text style={styles.historyLabel}>{h.label}</Text>
          <Text style={styles.historyWhen}>{h.when}</Text>
        </View>
      ))}

      <View style={[styles.sectionLabel, { marginTop: 16 }]}>
        <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }, runitTextGlowCyan]}>ACHIEVEMENTS</Text>
        <View style={styles.sectionLine} />
      </View>
      <View style={styles.badgeRow}>
        {mockBadges.map((b) => (
          <LinearGradient
            key={b.id}
            colors={b.earned ? [runit.neonCyan, runit.neonPurple] : ['rgba(50,50,60,0.9)', 'rgba(30,30,40,0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Text style={[styles.badgeText, { color: b.earned ? '#fff' : 'rgba(148,163,184,0.7)' }]}>{b.name}</Text>
          </LinearGradient>
        ))}
      </View>

      <AppButton title="Settings" variant="secondary" onPress={() => router.push('/(app)/(tabs)/profile/settings')} />
      <AppButton className="mt-2" title="Transactions" variant="ghost" onPress={() => router.push('/(app)/(tabs)/profile/transactions')} />
      {uid ? (
        <AppButton className="mt-2" title="Sign out" variant="danger" onPress={() => void signOut()} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCallout: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(0, 240, 255, 0.35)',
    backgroundColor: 'rgba(12, 6, 22, 0.88)',
  },
  accountCalloutTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
  },
  accountCalloutSub: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  accountCalloutRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  accountCalloutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: runit.neonPink,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  accountCalloutBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  accountCalloutBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(0, 240, 255, 0.55)',
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
  },
  accountCalloutBtnSecondaryText: { color: runit.neonCyan, fontWeight: '900', fontSize: 14 },
  signedInNote: {
    color: 'rgba(0, 240, 255, 0.9)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 },
  avatarRing: { width: 72, height: 72, borderRadius: 36, padding: 2 },
  avatarInner: {
    flex: 1,
    borderRadius: 34,
    backgroundColor: 'rgba(6,2,14,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: runit.neonCyan,
    borderRadius: 999,
    padding: 5,
    borderWidth: 2,
    borderColor: 'rgba(6,2,14,0.95)',
  },
  headerText: { flex: 1 },
  fieldLbl: { color: 'rgba(148,163,184,0.9)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.45)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: 'rgba(8,4,18,0.75)',
  },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  saveBtn: {
    backgroundColor: runit.neonPink,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    minWidth: 100,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  clearPhoto: { paddingVertical: 6 },
  clearPhotoText: { color: runit.neonCyan, fontSize: 12, fontWeight: '700' },
  hint: { color: 'rgba(148,163,184,0.75)', fontSize: 11, marginTop: 8, lineHeight: 15 },
  walletOuter: { borderRadius: 18, padding: 2, marginBottom: 20 },
  walletInner: { borderRadius: 16, backgroundColor: 'rgba(6,2,14,0.72)', paddingVertical: 16, paddingHorizontal: 16 },
  walletTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  walletTitle: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  walletBalance: {
    color: runit.neonCyan,
    fontSize: 34,
    fontWeight: '900',
    textShadowColor: runit.neonCyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  walletSub: { color: 'rgba(148,163,184,0.85)', fontSize: 12, marginTop: 4, marginBottom: 14 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  pill: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.25)',
    backgroundColor: 'rgba(6,2,14,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 80,
  },
  pillWide: { flex: 1 },
  pillLbl: { color: 'rgba(148,163,184,0.8)', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 3 },
  pillVal: { color: '#fff', fontSize: 16, fontWeight: '900' },
  addFundsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(0,240,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(0,240,255,0.55)',
  },
  addFundsBtnText: { color: runit.neonCyan, fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  walletBtns: { flexDirection: 'row', gap: 10 },
  wBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
  wBtnPrimary: { backgroundColor: runit.neonPink, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  wBtnGhost: { borderWidth: 2, borderColor: 'rgba(0,240,255,0.55)', backgroundColor: 'rgba(0,240,255,0.06)' },
  wBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle: { color: runit.neonCyan, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(157,78,237,0.4)' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statGrad: { flex: 1, borderRadius: 14, padding: 2 },
  statInner: { backgroundColor: 'rgba(6,2,14,0.8)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  statLbl: { color: 'rgba(148,163,184,0.8)', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(12,6,22,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyLabel: { flex: 1, color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  historyWhen: { color: 'rgba(148,163,184,0.8)', fontSize: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  badge: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
});
