import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ArcadeGameRow } from '@/components/arcade/ArcadeGameRow';
import {
  BallRunGameIcon,
  DashDuelGameIcon,
  NeonDanceGameIcon,
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
    case 'neon-dance':
      return <NeonDanceGameIcon size={size} />;
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
    const ec = Math.round(entryUsd * 100);
    const pc = Math.round(prizeUsd * 100);
    const e = encodeURIComponent(String(entryUsd));
    const p = encodeURIComponent(String(prizeUsd));
    const g = encodeURIComponent(gameKey);
    router.replace(
      `/(app)/(tabs)/play/casual?entryCents=${ec}&prizeCents=${pc}&entry=${e}&prize=${p}&game=${g}&intent=start` as never,
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.75 }]} hitSlop={12}>
        <SafeIonicons name="chevron-back" size={24} color={arcade.gold} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>HEAD-TO-HEAD</Text>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>Choose your game</Text>
      <View style={styles.tierSummary}>
        <View style={styles.tierSummaryCol}>
          <Text style={styles.tierSummaryLbl}>Match access</Text>
          <Text style={styles.tierSummaryAmt}>{entry}</Text>
        </View>
        <View style={styles.tierSummaryRule} />
        <View style={[styles.tierSummaryCol, styles.tierSummaryColPrize]}>
          <Text style={styles.tierSummaryPrizeLbl}>🏆 Top performer prize</Text>
          <Text style={styles.tierSummaryPrizeAmt}>{prize}</Text>
        </View>
      </View>
      <Text style={styles.sub}>
        Your entry covers contest access; listed prizes are Run It–funded. Didn&apos;t win? You&apos;ll still earn Arcade Credits. Tap a
        game — same neon look as Arcade.
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
    marginBottom: 12,
  },
  tierSummary: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 12,
    marginHorizontal: 4,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    backgroundColor: 'rgba(15,23,42,0.75)',
  },
  tierSummaryCol: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tierSummaryColPrize: { backgroundColor: 'rgba(30,27,75,0.5)' },
  tierSummaryLbl: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  tierSummaryAmt: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  tierSummaryRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginVertical: 10,
  },
  tierSummaryPrizeLbl: {
    color: 'rgba(254,243,199,0.95)',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  tierSummaryPrizeAmt: {
    color: '#FDE047',
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  sub: {
    color: 'rgba(203,213,225,0.88)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  em: { color: '#fde68a', fontWeight: '800' },
  list: { paddingBottom: 24 },
});
