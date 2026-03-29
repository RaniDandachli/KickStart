import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ArcadeFloor } from '@/components/arcade/ArcadeFloor';
import { ArcadeGameRow } from '@/components/arcade/ArcadeGameRow';
import { DashDuelGameIcon, TapDashGameIcon, TileClashGameIcon } from '@/components/arcade/MinigameIcons';
import { arcade } from '@/lib/arcadeTheme';

export default function MinigamesHubScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <ArcadeFloor>
      <Text style={styles.title}>MINI GAMES</Text>
      <Text style={styles.sub}>Pick a mode — same rules vs AI</Text>

      <ArcadeGameRow
        title="Tap Dash"
        entryLabel="VS AI"
        winLabel="PLAY"
        bgColors={['#93C5FD', '#60A5FA', '#2563EB']}
        winTone="lime"
        entryColor="rgba(15,23,42,0.9)"
        iconSlot={<TapDashGameIcon size={36} />}
        onPress={() => router.push('/(app)/(tabs)/play/minigames/tap-dash')}
      />
      <ArcadeGameRow
        title="Tile Clash"
        entryLabel="VS AI"
        winLabel="PLAY"
        bgColors={['#1e1b4b', '#3730a3', '#5b21b6']}
        winTone="sky"
        entryColor="rgba(255,255,255,0.88)"
        iconSlot={<TileClashGameIcon size={36} />}
        onPress={() => router.push('/(app)/(tabs)/play/minigames/tile-clash')}
      />
      <ArcadeGameRow
        title="Dash Duel"
        entryLabel="VS AI"
        winLabel="PLAY"
        bgColors={['#020617', '#0f172a', '#1e1b4b']}
        winTone="orange"
        titleColor="#e2e8f0"
        entryColor="rgba(148,163,184,0.95)"
        iconSlot={<DashDuelGameIcon size={36} />}
        onPress={() => router.push('/(app)/(tabs)/play/minigames/dash-duel')}
      />

      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.backHint}>← Back to arcade</Text>
      </Pressable>
    </ArcadeFloor>
  );
}

const styles = StyleSheet.create({
  title: {
    color: arcade.white,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    color: arcade.textMuted,
    textAlign: 'center',
    marginBottom: 18,
    fontWeight: '600',
    fontSize: 13,
  },
  backHint: {
    marginTop: 16,
    textAlign: 'center',
    color: arcade.gold,
    fontWeight: '800',
    fontSize: 14,
  },
});
