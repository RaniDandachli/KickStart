import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ArcadeGameRow } from '@/components/arcade/ArcadeGameRow';
import {
  BallRunGameIcon,
  DashDuelGameIcon,
  NeonPoolGameIcon,
  TapDashGameIcon,
  TileClashGameIcon,
  TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { Screen } from '@/components/ui/Screen';
import { H2H_OPEN_GAMES } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { arcade } from '@/lib/arcadeTheme';
import { runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';

type Props = {
  entryUsd: number;
  prizeUsd: number;
};

function gameIcon(gameKey: (typeof H2H_OPEN_GAMES)[number]['gameKey'], size: number) {
  switch (gameKey) {
    case 'tap-dash':
      return <TapDashGameIcon size={size} />;
    case 'tile-clash':
      return <TileClashGameIcon size={size} />;
    case 'dash-duel':
      return <DashDuelGameIcon size={size} />;
    case 'ball-run':
      return <BallRunGameIcon size={size} />;
    case 'turbo-arena':
      return <TurboArenaGameIcon size={size} />;
    case 'neon-pool':
      return <NeonPoolGameIcon size={size} />;
    default:
      return <TapDashGameIcon size={size} />;
  }
}

/**
 * Contest tier from Home only sets fee + fixed reward — user must pick minigame before queue.
 * Same card chrome as Arcade “Hot games” (logos + gradients).
 */
export function PickGameForQueue({ entryUsd, prizeUsd }: Props) {
  const router = useRouter();
  const entry = formatUsdFromCents(Math.round(entryUsd * 100));
  const prize = formatUsdFromCents(Math.round(prizeUsd * 100));

  function pick(gameKey: string) {
    const e = encodeURIComponent(String(entryUsd));
    const p = encodeURIComponent(String(prizeUsd));
    const g = encodeURIComponent(gameKey);
    router.replace(`/(app)/(tabs)/play/casual?entry=${e}&prize=${p}&game=${g}&intent=start` as never);
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.75 }]} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={arcade.gold} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>HEAD-TO-HEAD</Text>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>Choose your game</Text>
      <Text style={styles.sub}>
        Contest fee <Text style={styles.em}>{entry}</Text> · fixed reward <Text style={styles.em}>{prize}</Text> (KickClash-funded). Tap a
        game — same look as Arcade.
      </Text>

      <View style={styles.list}>
        {H2H_OPEN_GAMES.map((g) => (
          <ArcadeGameRow
            key={g.gameKey}
            title={g.title}
            entryLabel="Head-to-head · this contest tier"
            winLabel="Select"
            bgColors={g.bgColors}
            borderAccent={g.borderAccent}
            iconSlot={gameIcon(g.gameKey, 42)}
            emphasized
            onPress={() => pick(g.gameKey)}
            titleColor={g.gameKey === 'dash-duel' ? '#e2e8f0' : '#fff'}
            entryColor={g.gameKey === 'dash-duel' ? 'rgba(148,163,184,0.95)' : 'rgba(226,232,240,0.9)'}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 2,
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    color: arcade.gold,
    fontSize: 17,
    fontWeight: '800',
  },
  kicker: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: {
    color: 'rgba(203,213,225,0.92)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  em: { color: '#fde68a', fontWeight: '800' },
  list: { paddingBottom: 24 },
});
