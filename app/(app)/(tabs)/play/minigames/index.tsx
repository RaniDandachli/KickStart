import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ArcadeFloor } from '@/components/arcade/ArcadeFloor';
import { ArcadeMinigameRow } from '@/components/arcade/ArcadeMinigameRow';
import {
  BallRunGameIcon,
  DashDuelGameIcon,
  NeonPoolGameIcon,
  StackerGameIcon,
  TapDashGameIcon,
  TileClashGameIcon,
  TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { runitFont, runitTextGlowCyan } from '@/lib/runitArcadeTheme';
import { useRestoreBottomTabBarOnFocus } from '@/minigames/ui/useHidePlayTabBar';

export default function MinigamesHubScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  useRestoreBottomTabBarOnFocus();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <ArcadeFloor>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowCyan]}>MINI GAMES</Text>
      <Text style={styles.sub}>Tap PLAY — Practice (free) or Prize run (costs prize credits)</Text>

      <ArcadeMinigameRow
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
        gameRoute="dash-duel"
        title="Dash Duel"
        entryLabel="Practice or prize run"
        winLabel="PLAY"
        bgColors={['#020617', '#0c4a6e', '#164e63']}
        borderAccent="cyan"
        titleColor="#e2e8f0"
        entryColor="rgba(148,163,184,0.95)"
        iconSlot={<DashDuelGameIcon size={36} />}
      />
      <ArcadeMinigameRow
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
        gameRoute="turbo-arena"
        title="Turbo Arena"
        entryLabel="Practice or prize run"
        winLabel="PLAY"
        bgColors={['#020617', '#0c4a6e', '#7c2d12']}
        borderAccent="cyan"
        entryColor="rgba(226,232,240,0.9)"
        iconSlot={<TurboArenaGameIcon size={36} />}
      />
      <ArcadeMinigameRow
        gameRoute="neon-pool"
        title="Neon Pocket"
        entryLabel="Classic 8-ball rules · practice or prize"
        winLabel="PLAY"
        bgColors={['#052e16', '#0f172a', '#14532d']}
        borderAccent="cyan"
        entryColor="rgba(226,232,240,0.9)"
        iconSlot={<NeonPoolGameIcon size={36} />}
      />
      <ArcadeMinigameRow
        gameRoute="stacker"
        title="Stacker"
        entryLabel="Jackpot prize · practice or prize run"
        winLabel="PLAY"
        bgColors={['#0c0a0f', '#1e1b4b', '#831843']}
        borderAccent="purple"
        entryColor="rgba(226,232,240,0.9)"
        iconSlot={<StackerGameIcon size={36} />}
      />

      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.backHint}>← Back to arcade</Text>
      </Pressable>
    </ArcadeFloor>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#00f0ff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    color: 'rgba(148, 163, 184, 0.95)',
    textAlign: 'center',
    marginBottom: 18,
    fontWeight: '600',
    fontSize: 13,
  },
  backHint: {
    marginTop: 16,
    textAlign: 'center',
    color: '#ff006e',
    fontWeight: '800',
    fontSize: 14,
  },
});
