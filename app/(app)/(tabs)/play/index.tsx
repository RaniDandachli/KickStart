import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { ArcadeFloor } from '@/components/arcade/ArcadeFloor';
import { ArcadeGameRow } from '@/components/arcade/ArcadeGameRow';
import { ArcadeGrantBanner } from '@/components/arcade/ArcadeGrantBanner';
import { ArcadeHowItWorksModal } from '@/components/arcade/ArcadeHowItWorksModal';
import { ArcadeHubCreditsBanner } from '@/components/arcade/ArcadeHubCreditsBanner';
import { ArcadeHubDiscovery } from '@/components/arcade/ArcadeHubDiscovery';
import { ShapeDashGameIcon } from '@/components/arcade/MinigameIcons';
import { GuestAuthPromptModal, type GuestAuthPromptVariant } from '@/components/auth/GuestAuthPromptModal';
import { BackendModeBanner } from '@/components/BackendModeBanner';
import { ENABLE_BACKEND, SHOW_SHAPE_DASH_MINIGAME } from '@/constants/featureFlags';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useProfile } from '@/hooks/useProfile';
import { pushCrossTab } from '@/lib/appNavigation';
import { ARCADE_HUB_RETURN_PATH, withReturnHref } from '@/lib/minigameReturnHref';
import { presentAddMoneyChooser } from '@/lib/shopNavigation';
import { useRestoreBottomTabBarOnFocus } from '@/minigames/ui/useHidePlayTabBar';
import { useAuthStore } from '@/store/authStore';
import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export default function PlayHubScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [arcadeHowItWorksOpen, setArcadeHowItWorksOpen] = useState(false);
  const [guestPrompt, setGuestPrompt] = useState<GuestAuthPromptVariant | null>(null);
  const uid = useAuthStore((s) => s.user?.id);
  const needAccount = ENABLE_BACKEND && !uid;

  function onAddMoneyPress() {
    if (needAccount) setGuestPrompt('arcade_credits');
    else presentAddMoneyChooser(router);
  }
  const profileQ = useProfile(uid);
  const demoPrizeCredits = usePrizeCreditsDisplay();
  useRestoreBottomTabBarOnFocus();

  const creditsFormatted = useMemo(() => {
    if (!ENABLE_BACKEND) return demoPrizeCredits.toLocaleString();
    if (profileQ.isLoading) return '…';
    return (profileQ.data?.prize_credits ?? 0).toLocaleString();
  }, [demoPrizeCredits, profileQ.data?.prize_credits, profileQ.isLoading]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const shapeDashRow = useMemo(() => {
    if (!SHOW_SHAPE_DASH_MINIGAME) return null;
    return (
      <ArcadeGameRow
        compact
        pressable
        title="Shape Dash"
        entryLabel="New"
        winLabel="PLAY"
        bgColors={['#050a12', '#0c4a6e', '#14532d']}
        borderAccent="gold"
        entryColor="rgba(226,232,240,0.9)"
        iconSlot={<ShapeDashGameIcon size={32} />}
        onPress={() =>
          router.push(
            withReturnHref('/(app)/(tabs)/play/minigames/shape-dash', ARCADE_HUB_RETURN_PATH) as never,
          )
        }
      />
    );
  }, [router]);

  return (
    <View style={styles.root}>
      <ArcadeFloor>
        <BackendModeBanner />

        <ArcadeHubCreditsBanner
          creditsFormatted={creditsFormatted}
          onAddPress={onAddMoneyPress}
          onHowItWorks={() => setArcadeHowItWorksOpen(true)}
          onEarnInfo={() => setArcadeHowItWorksOpen(true)}
          onRedeemPrizes={() => pushCrossTab(router, '/(app)/(tabs)/prizes')}
        />

        {ENABLE_BACKEND && uid && profileQ.isError ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading profile"
            onPress={() => void profileQ.refetch()}
            style={({ pressed }) => [styles.profileErrBanner, pressed && { opacity: 0.88 }]}
          >
            <SafeIonicons name="cloud-offline-outline" size={18} color="#fecaca" />
            <Text style={styles.profileErrTxt}>Could not refresh your balance. Tap to retry.</Text>
          </Pressable>
        ) : null}

        {ENABLE_BACKEND &&
        uid &&
        profileQ.isSuccess &&
        (profileQ.data?.prize_credits ?? 0) === 0 ? (
          <View style={styles.prizeZeroBox}>
            <SafeIonicons name="sparkles-outline" size={18} color="#c4b5fd" />
            <Text style={styles.prizeZeroTxt}>
              You have 0 prize credits — earn them from prize runs and events, or play practice for free (no credits).
            </Text>
            <View style={styles.prizeZeroRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play practice"
                onPress={() =>
                  router.push(
                    withReturnHref(
                      '/(app)/(tabs)/play/minigames/tap-dash?mode=practice',
                      ARCADE_HUB_RETURN_PATH,
                    ) as never,
                  )
                }
                style={({ pressed }) => [styles.prizeZeroChip, pressed && { opacity: 0.88 }]}
              >
                <Text style={styles.prizeZeroChipTxt}>Practice free</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add funds"
                onPress={onAddMoneyPress}
                style={({ pressed }) => [styles.prizeZeroChip, styles.prizeZeroChipGhost, pressed && { opacity: 0.88 }]}
              >
                <Text style={[styles.prizeZeroChipTxt, { color: '#FFD700' }]}>Add funds</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <ArcadeGrantBanner />

        <ArcadeHubDiscovery shapeDashRow={shapeDashRow} />

        {Platform.OS !== 'web' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open prize catalog"
            onPress={() => pushCrossTab(router, '/(app)/(tabs)/prizes')}
            style={({ pressed }) => [styles.prizesLink, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.prizesLinkTxt}>Prize catalog →</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footer}>
          Arcade: spend credits on runs. Home: 1v1 skill contests with tier prizes paid by Run It.
        </Text>
      </ArcadeFloor>
      <ArcadeHowItWorksModal visible={arcadeHowItWorksOpen} onClose={() => setArcadeHowItWorksOpen(false)} />
      <GuestAuthPromptModal
        visible={guestPrompt != null}
        variant={guestPrompt ?? 'arcade_credits'}
        onClose={() => setGuestPrompt(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  profileErrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(127,29,29,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
  },
  profileErrTxt: {
    flex: 1,
    color: 'rgba(254,226,226,0.98)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  prizeZeroBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(76,29,149,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.4)',
  },
  prizeZeroTxt: {
    flex: 1,
    minWidth: 200,
    color: 'rgba(237,233,254,0.98)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  prizeZeroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginTop: 4 },
  prizeZeroChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.55)',
  },
  prizeZeroChipGhost: { backgroundColor: 'transparent', borderColor: 'rgba(255,215,0,0.45)' },
  prizeZeroChipTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  prizesLink: { alignSelf: 'center', marginTop: 8, marginBottom: 4, paddingVertical: 8 },
  prizesLinkTxt: { color: 'rgba(196,181,253,0.95)', fontSize: 12, fontWeight: '800' },
  footer: {
    marginTop: 16,
    textAlign: 'center',
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.9,
  },
});
