import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useNavigation, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useLayoutEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ArcadeBalanceBar } from '@/components/arcade/ArcadeBalanceBar';
import { ArcadeGameRow } from '@/components/arcade/ArcadeGameRow';
import { ArcadeFloor } from '@/components/arcade/ArcadeFloor';
import { ArcadeGrantBanner } from '@/components/arcade/ArcadeGrantBanner';
import { ArcadeHowItWorksModal } from '@/components/arcade/ArcadeHowItWorksModal';
import { ArcadeMinigameRow } from '@/components/arcade/ArcadeMinigameRow';
import { ArcadePlayModeModal } from '@/components/arcade/ArcadePlayModeModal';
import { ArcadePromoBanner } from '@/components/arcade/ArcadePromoBanner';
import { ArcadeQuickMatch } from '@/components/arcade/ArcadeQuickMatch';
import { ArcadeRewardsGuide } from '@/components/arcade/ArcadeRewardsGuide';
import { ArcadeStatsRow } from '@/components/arcade/ArcadeStatsRow';
import {
    BallRunGameIcon,
    DashDuelGameIcon,
    NeonDanceGameIcon,
    NeonGridGameIcon,
    NeonShipGameIcon,
    ShapeDashGameIcon,
    StackerGameIcon,
    TapDashGameIcon,
    TileClashGameIcon,
    TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { GuestAuthPromptModal, type GuestAuthPromptVariant } from '@/components/auth/GuestAuthPromptModal';
import { BackendModeBanner } from '@/components/BackendModeBanner';
import {
  ENABLE_BACKEND,
  SHOW_NEON_SHIP_MINIGAME,
  SHOW_SHAPE_DASH_MINIGAME,
} from '@/constants/featureFlags';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useProfile } from '@/hooks/useProfile';
import { pushCrossTab, ROUTES } from '@/lib/appNavigation';
import { ARCADE_HUB_RETURN_PATH, withReturnHref } from '@/lib/minigameReturnHref';
import { dailyRaceHref } from '@/lib/tabRoutes';
import { runit, runitFont, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { presentAddMoneyChooser } from '@/lib/shopNavigation';
import { useRestoreBottomTabBarOnFocus } from '@/minigames/ui/useHidePlayTabBar';
import { useAuthStore } from '@/store/authStore';

export default function PlayHubScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [soloPlayGate, setSoloPlayGate] = useState(false);
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

  const prizeBalanceLabel = !ENABLE_BACKEND
    ? `${demoPrizeCredits.toLocaleString()} prize credits`
    : profileQ.isLoading
      ? '…'
      : `${(profileQ.data?.prize_credits ?? 0).toLocaleString()} prize credits`;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <View style={styles.root}>
      <ArcadeFloor>
        <BackendModeBanner />
        <View style={styles.brandBlock}>
          <Text style={[styles.brandArcadeOnly, { fontFamily: runitFont.black }, runitTextGlowCyan]}>Arcade</Text>
        </View>
        <Text style={styles.arcadeTagline}>
          {Platform.OS === 'web'
            ? 'Spend Arcade Credits on runs (about 10–20 per game) · earn tickets · redeem in Prizes'
            : 'Spend Arcade Credits on runs (about 10–20 per game) · earn tickets · redeem in Prize catalog (below)'}
        </Text>
        <Pressable
          onPress={() => setArcadeHowItWorksOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="How Arcade works"
          style={({ pressed }) => [styles.howItWorksRow, pressed && { opacity: 0.88 }]}
        >
          <SafeIonicons name="information-circle-outline" size={18} color="rgba(167,139,250,0.95)" />
          <Text style={styles.howItWorksText}>How Arcade works</Text>
        </Pressable>

        {Platform.OS !== 'web' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open prize catalog"
            onPress={() => pushCrossTab(router, '/(app)/(tabs)/prizes')}
            style={({ pressed }) => [styles.prizesFromArcadeRow, pressed && { opacity: 0.9 }]}
          >
            <LinearGradient
              colors={['rgba(250,204,21,0.35)', 'rgba(139,92,246,0.55)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.prizesFromArcadeBorder}
            >
              <View style={styles.prizesFromArcadeInner}>
                <SafeIonicons name="gift-outline" size={22} color="#fde047" />
                <View style={styles.prizesFromArcadeTextWrap}>
                  <Text style={[styles.prizesFromArcadeTitle, { fontFamily: runitFont.black }]}>
                    PRIZE CATALOG
                  </Text>
                  <Text style={styles.prizesFromArcadeSub}>Spend redeem tickets · same prizes as desktop</Text>
                </View>
                <SafeIonicons name="chevron-forward" size={20} color="rgba(248,250,252,0.92)" />
              </View>
            </LinearGradient>
          </Pressable>
        ) : null}

        <ArcadeBalanceBar balanceLabel={prizeBalanceLabel} onAddPress={onAddMoneyPress} />

        {ENABLE_BACKEND && uid && profileQ.isError ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading profile"
            onPress={() => void profileQ.refetch()}
            style={({ pressed }) => [styles.profileErrBanner, pressed && { opacity: 0.88 }]}
          >
            <SafeIonicons name="cloud-offline-outline" size={18} color="#fecaca" />
            <Text style={styles.profileErrTxt}>
              Could not refresh your balance. Tap to retry.
            </Text>
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

        <View style={styles.gamesSectionRow}>
          <SafeIonicons name="flame" size={20} color={runit.neonPink} />
          <Text style={[styles.gamesSection, { fontFamily: runitFont.black }, runitTextGlowPink]}>HOT GAMES</Text>
        </View>
        <Text style={styles.gamesSub}>Tap a game · practice free or prize run</Text>

        <ArcadeMinigameRow
          emphasized
          compact
          gameRoute="tap-dash"
          title="Tap Dash"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#1e1b4b', '#312e81', '#4c1d95']}
          borderAccent="pink"
          entryColor="rgba(226,232,240,0.9)"
          iconSlot={<TapDashGameIcon size={36} />}
        />
        <ArcadeMinigameRow
          emphasized
          compact
          gameRoute="tile-clash"
          title="Tile Clash"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#0f172a', '#1e1b4b', '#5b21b6']}
          borderAccent="purple"
          entryColor="rgba(226,232,240,0.9)"
          iconSlot={<TileClashGameIcon size={36} />}
        />
        <ArcadeMinigameRow
          emphasized
          compact
          gameRoute="cyber-road"
          title="Cyber Road"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#030712', '#1f2937', '#0f766e']}
          borderAccent="gold"
          entryColor="rgba(226,232,240,0.9)"
          iconSlot={<DashDuelGameIcon size={36} />}
        />
        <ArcadeMinigameRow
          emphasized
          compact
          gameRoute="dash-duel"
          title="Dash Duel"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#020617', '#0c4a6e', '#164e63']}
          borderAccent="gold"
          titleColor="#e2e8f0"
          entryColor="rgba(148,163,184,0.95)"
          iconSlot={<DashDuelGameIcon size={36} />}
        />
        <ArcadeMinigameRow
          emphasized
          compact
          gameRoute="ball-run"
          title="Neon Ball Run"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#1a0b2e', '#4c1d95', '#831843']}
          borderAccent="pink"
          entryColor="rgba(248,250,252,0.9)"
          iconSlot={<BallRunGameIcon size={36} />}
        />
        <ArcadeMinigameRow
          emphasized
          compact
          gameRoute="neon-dance"
          title="Neon Dance"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#050508', '#1e1b4b', '#312e81']}
          borderAccent="pink"
          entryColor="rgba(248,250,252,0.9)"
          iconSlot={<NeonDanceGameIcon size={36} />}
        />
        <ArcadeMinigameRow
          emphasized
          compact
          gameRoute="neon-grid"
          title="Street Dash"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#0f172a', '#312e81', '#831843']}
          borderAccent="purple"
          entryColor="rgba(248,250,252,0.9)"
          iconSlot={<NeonGridGameIcon size={36} />}
        />
        {SHOW_NEON_SHIP_MINIGAME ? (
          <ArcadeMinigameRow
            emphasized
            compact
            gameRoute="neon-ship"
            title="Void Glider"
            entryLabel="Practice or prize run"
            winLabel="PLAY"
            bgColors={['#1a0a2e', '#4c1d95', '#0f0220']}
            borderAccent="pink"
            entryColor="rgba(248,250,252,0.9)"
            iconSlot={<NeonShipGameIcon size={36} />}
          />
        ) : null}
        <ArcadeMinigameRow
          emphasized
          compact
          gameRoute="turbo-arena"
          title="Turbo Arena"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#020617', '#0c4a6e', '#7c2d12']}
          borderAccent="gold"
          entryColor="rgba(226,232,240,0.9)"
          iconSlot={<TurboArenaGameIcon size={36} />}
        />
        <ArcadeMinigameRow
          emphasized
          compact
          gameRoute="stacker"
          title="Stacker"
          entryLabel="Jackpot prize · practice or prize run"
          winLabel="PLAY"
          bgColors={['#0c0a0f', '#1e1b4b', '#831843']}
          borderAccent="purple"
          entryColor="rgba(226,232,240,0.9)"
          iconSlot={<StackerGameIcon size={36} />}
        />
        {SHOW_SHAPE_DASH_MINIGAME ? (
          <ArcadeGameRow
            emphasized
            compact
            title="Shape Dash"
            entryLabel="Canvas runner · plays in-app (no prize run)"
            winLabel="PLAY"
            bgColors={['#050a12', '#0c4a6e', '#14532d']}
            borderAccent="gold"
            entryColor="rgba(226,232,240,0.9)"
            iconSlot={<ShapeDashGameIcon size={36} />}
            onPress={() =>
              router.push(
                withReturnHref(
                  '/(app)/(tabs)/play/minigames/shape-dash',
                  ARCADE_HUB_RETURN_PATH,
                ) as never,
              )
            }
          />
        ) : null}

        <ArcadeStatsRow />

        <ArcadePromoBanner />

        <ArcadeRewardsGuide />

        <ArcadeQuickMatch
          onOneVsOne={() => pushCrossTab(router, '/(app)/(tabs)')}
          onSoloPlay={() => setSoloPlayGate(true)}
          onMoneyChallenges={() => pushCrossTab(router, dailyRaceHref())}
          onTournament={() => pushCrossTab(router, '/(app)/(tabs)/tournaments')}
        />

        <ArcadePlayModeModal
          visible={soloPlayGate}
          gameTitle="Tap Dash"
          onClose={() => setSoloPlayGate(false)}
          onPractice={() => {
            setSoloPlayGate(false);
            router.push(
              withReturnHref(
                '/(app)/(tabs)/play/minigames/tap-dash?mode=practice',
                ROUTES.playTab,
              ) as never,
            );
          }}
          onPrizeRun={() => {
            setSoloPlayGate(false);
            router.push(
              withReturnHref(
                '/(app)/(tabs)/play/minigames/tap-dash?mode=prize',
                ROUTES.playTab,
              ) as never,
            );
          }}
        />

        <Text style={styles.footer}>
          Arcade: earn Arcade Credits vs AI. Home: 1v1 skill contests with tier prizes paid by Run It.
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
  brandBlock: {
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 4,
  },
  brandArcadeOnly: {
    color: '#a78bfa',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 4,
  },
  arcadeTagline: {
    color: 'rgba(203, 213, 225, 0.95)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  howItWorksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 4,
  },
  howItWorksText: {
    color: 'rgba(167,139,250,0.95)',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(167,139,250,0.45)',
  },
  prizesFromArcadeRow: { marginBottom: 14 },
  prizesFromArcadeBorder: { borderRadius: 14, padding: 2 },
  prizesFromArcadeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(6,2,14,0.88)',
  },
  prizesFromArcadeTextWrap: { flex: 1 },
  prizesFromArcadeTitle: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  prizesFromArcadeSub: { color: 'rgba(226,232,240,0.85)', fontSize: 11, fontWeight: '600' },
  gamesSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 2,
    marginTop: 6,
  },
  gamesSection: {
    color: 'rgba(255, 255, 255, 0.98)',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  gamesSub: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  footer: {
    marginTop: 20,
    textAlign: 'center',
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.9,
  },
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
});
