import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ArcadeBalanceBar } from '@/components/arcade/ArcadeBalanceBar';
import { ArcadeFloor } from '@/components/arcade/ArcadeFloor';
import { ArcadeGameRow } from '@/components/arcade/ArcadeGameRow';
import { ArcadePromoBanner } from '@/components/arcade/ArcadePromoBanner';
import { ArcadeQuickMatch } from '@/components/arcade/ArcadeQuickMatch';
import { DashDuelGameIcon, TapDashGameIcon, TileClashGameIcon } from '@/components/arcade/MinigameIcons';
import { arcade } from '@/lib/arcadeTheme';

export default function PlayHubScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <ArcadeFloor>
      <Text style={styles.arcadeTitle}>ARCADE</Text>
      <Text style={styles.arcadeTagline}>VS AI for prize credits · redeem in Prizes</Text>
      <ArcadeBalanceBar
        balanceLabel="1,240 prize credits"
        onAddPress={() => Alert.alert('Run it', 'Buy tickets or watch ads for extra runs — coming soon.')}
      />
      <ArcadePromoBanner />

      <Text style={styles.gamesSection}>Games</Text>

      <ArcadeGameRow
        title="Tap Dash"
        entryLabel="Prize credits"
        winLabel="PLAY"
        bgColors={['#93C5FD', '#60A5FA', '#2563EB']}
        winTone="lime"
        entryColor="rgba(15,23,42,0.9)"
        iconSlot={<TapDashGameIcon size={36} />}
        onPress={() => router.push('/(app)/(tabs)/play/minigames/tap-dash')}
      />
      <ArcadeGameRow
        title="Tile Clash"
        entryLabel="Prize credits"
        winLabel="PLAY"
        bgColors={['#1e1b4b', '#3730a3', '#5b21b6']}
        winTone="sky"
        entryColor="rgba(255,255,255,0.88)"
        iconSlot={<TileClashGameIcon size={36} />}
        onPress={() => router.push('/(app)/(tabs)/play/minigames/tile-clash')}
      />
      <ArcadeGameRow
        title="Dash Duel"
        entryLabel="Prize credits"
        winLabel="PLAY"
        bgColors={['#020617', '#0f172a', '#1e1b4b']}
        winTone="orange"
        titleColor="#e2e8f0"
        entryColor="rgba(148,163,184,0.95)"
        iconSlot={<DashDuelGameIcon size={36} />}
        onPress={() => router.push('/(app)/(tabs)/play/minigames/dash-duel')}
      />

      <ArcadeQuickMatch
        onCashHome={() => router.push('/(app)/(tabs)')}
        onTournament={() => router.push('/(app)/(tabs)/tournaments')}
      />

      <Text style={styles.footer}>
        Arcade: earn prize credits vs AI. Home tab: real-money 1v1 vs players. Queues are demo until connected.
      </Text>
    </ArcadeFloor>
  );
}

const styles = StyleSheet.create({
  practiceRule: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  practiceTitle: {
    color: arcade.textMuted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  practiceLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.35)',
  },
  arcadeTitle: {
    color: arcade.white,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
  gamesSection: {
    color: arcade.textMuted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  footer: {
    marginTop: 20,
    textAlign: 'center',
    color: arcade.textMuted,
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.85,
  },
});
