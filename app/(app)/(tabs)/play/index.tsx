import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ArcadeCabinetIntro } from '@/components/arcade/ArcadeCabinetIntro';
import { ArcadeBalanceBar } from '@/components/arcade/ArcadeBalanceBar';
import { ArcadeFloor } from '@/components/arcade/ArcadeFloor';
import { ArcadeGrantBanner } from '@/components/arcade/ArcadeGrantBanner';
import { ArcadeRewardsGuide } from '@/components/arcade/ArcadeRewardsGuide';
import { ArcadeMinigameRow } from '@/components/arcade/ArcadeMinigameRow';
import { ArcadePlayModeModal } from '@/components/arcade/ArcadePlayModeModal';
import { ArcadePromoBanner } from '@/components/arcade/ArcadePromoBanner';
import { ArcadeQuickMatch } from '@/components/arcade/ArcadeQuickMatch';
import { ArcadeStatsRow } from '@/components/arcade/ArcadeStatsRow';
import {
  BallRunGameIcon,
  DashDuelGameIcon,
  TapDashGameIcon,
  TileClashGameIcon,
  TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { usePrizeCreditsDisplay } from '@/hooks/usePrizeCreditsDisplay';
import { useProfile } from '@/hooks/useProfile';
import { topUpComingSoonMessage } from '@/lib/purchaseEconomy';
import { runitFont, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useRestoreBottomTabBarOnFocus } from '@/minigames/ui/useHidePlayTabBar';
import { useAuthStore } from '@/store/authStore';

/** Once per JS session (until app reload) — avoids replaying cabinet every time you open the Arcade tab. */
let arcadeCabinetIntroPlayedThisSession = false;

export default function PlayHubScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [showCabinetIntro, setShowCabinetIntro] = useState(() => !arcadeCabinetIntroPlayedThisSession);
  const [soloPlayGate, setSoloPlayGate] = useState(false);
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const demoPrizeCredits = usePrizeCreditsDisplay();
  useRestoreBottomTabBarOnFocus();

  const onCabinetIntroDone = useCallback(() => {
    arcadeCabinetIntroPlayedThisSession = true;
    setShowCabinetIntro(false);
  }, []);

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
        <View style={styles.brandBlock}>
          <Text style={[styles.brandRunit, { fontFamily: runitFont.black }, runitTextGlowPink]}>Run it</Text>
          <Text style={[styles.brandArcade, { fontFamily: runitFont.black }, runitTextGlowCyan]}>ARCADE</Text>
        </View>
        <Text style={styles.arcadeTagline}>Spend prize credits on runs · redeem tickets for rewards in Prizes</Text>

        <ArcadeBalanceBar
          balanceLabel={prizeBalanceLabel}
          onAddPress={() => Alert.alert('Run it', topUpComingSoonMessage())}
        />

        <ArcadeGrantBanner />

        <View style={styles.gamesSectionRow}>
          <Ionicons name="flame" size={20} color="#ff006e" />
          <Text style={[styles.gamesSection, { fontFamily: runitFont.black }, runitTextGlowPink]}>HOT GAMES</Text>
        </View>
        <Text style={styles.gamesSub}>Tap a game · practice free or prize run</Text>

        <ArcadeMinigameRow
          emphasized
          gameRoute="tap-dash"
          title="Tap Dash"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#1e1b4b', '#312e81', '#4c1d95']}
          borderAccent="pink"
          entryColor="rgba(226,232,240,0.9)"
          iconSlot={<TapDashGameIcon size={42} />}
        />
        <ArcadeMinigameRow
          emphasized
          gameRoute="tile-clash"
          title="Tile Clash"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#0f172a', '#1e1b4b', '#5b21b6']}
          borderAccent="purple"
          entryColor="rgba(226,232,240,0.9)"
          iconSlot={<TileClashGameIcon size={42} />}
        />
        <ArcadeMinigameRow
          emphasized
          gameRoute="dash-duel"
          title="Dash Duel"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#020617', '#0c4a6e', '#164e63']}
          borderAccent="cyan"
          titleColor="#e2e8f0"
          entryColor="rgba(148,163,184,0.95)"
          iconSlot={<DashDuelGameIcon size={42} />}
        />
        <ArcadeMinigameRow
          emphasized
          gameRoute="ball-run"
          title="Neon Ball Run"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#1a0b2e', '#4c1d95', '#831843']}
          borderAccent="pink"
          entryColor="rgba(248,250,252,0.9)"
          iconSlot={<BallRunGameIcon size={42} />}
        />
        <ArcadeMinigameRow
          emphasized
          gameRoute="turbo-arena"
          title="Turbo Arena"
          entryLabel="Practice or prize run"
          winLabel="PLAY"
          bgColors={['#020617', '#0c4a6e', '#7c2d12']}
          borderAccent="cyan"
          entryColor="rgba(226,232,240,0.9)"
          iconSlot={<TurboArenaGameIcon size={42} />}
        />

        <ArcadeStatsRow />

        <ArcadePromoBanner />

        <ArcadeRewardsGuide />

        <ArcadeQuickMatch
          onOneVsOne={() => router.push('/(app)/(tabs)')}
          onSoloPlay={() => setSoloPlayGate(true)}
          onTournament={() => router.push('/(app)/(tabs)/tournaments')}
        />

        <ArcadePlayModeModal
          visible={soloPlayGate}
          gameTitle="Tap Dash"
          onClose={() => setSoloPlayGate(false)}
          onPractice={() => {
            setSoloPlayGate(false);
            router.push('/(app)/(tabs)/play/minigames/tap-dash?mode=practice');
          }}
          onPrizeRun={() => {
            setSoloPlayGate(false);
            router.push('/(app)/(tabs)/play/minigames/tap-dash?mode=prize');
          }}
        />

        <Text style={styles.footer}>
          Arcade: earn prize credits vs AI. Home: 1v1 skill contests with fixed KickClash-funded rewards. Queues are demo until connected.
        </Text>
      </ArcadeFloor>
      {showCabinetIntro ? <ArcadeCabinetIntro onComplete={onCabinetIntroDone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 4,
  },
  brandRunit: {
    color: '#ff006e',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandArcade: {
    color: '#00f0ff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 10,
    marginTop: -4,
  },
  arcadeTagline: {
    color: 'rgba(203, 213, 225, 0.95)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  gamesSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
    marginTop: 8,
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
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 14,
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
});
