import { ArcadeGameRow } from '@/components/arcade/ArcadeGameRow';
import { MATCH_ENTRY_TIERS, type MatchEntryTier } from '@/components/arcade/matchEntryTiers';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import {
  BallRunGameIcon,
  DashDuelGameIcon,
  TapDashGameIcon,
  TileClashGameIcon,
  TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { Screen } from '@/components/ui/Screen';
import { H2H_OPEN_GAMES, type H2hGameKey } from '@/lib/homeOpenMatches';
import { arcade } from '@/lib/arcadeTheme';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function gameIcon(gameKey: H2hGameKey, size: number) {
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
    default:
      return <TapDashGameIcon size={size} />;
  }
}

/**
 * Pick contest tier + minigame, then open casual queue with `intent=start` (same pool as Find opponent).
 */
export function ChooseContestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [tier, setTier] = useState<MatchEntryTier | null>(null);
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = typeof rawReturnTo === 'string' && rawReturnTo.startsWith('/') ? rawReturnTo : undefined;

  function goQueue(gameKey: H2hGameKey) {
    if (!tier) return;
    const ec = Math.round(tier.entry * 100);
    const pc = Math.round(tier.prize * 100);
    const e = encodeURIComponent(String(tier.entry));
    const p = encodeURIComponent(String(tier.prize));
    const g = encodeURIComponent(gameKey);
    const rt = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : '';
    router.replace(
      `/(app)/(tabs)/play/casual?entryCents=${ec}&prizeCents=${pc}&entry=${e}&prize=${p}&game=${g}&intent=start${rt}` as never,
    );
  }

  const entryLabel = tier ? formatUsdFromCents(Math.round(tier.entry * 100)) : '—';
  const prizeLabel = tier ? formatUsdFromCents(Math.round(tier.prize * 100)) : '—';

  return (
    <Screen>
      <Pressable
        onPress={() => (returnTo ? router.replace(returnTo as never) : router.back())}
        style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.75 }]}
        hitSlop={12}
      >
        <SafeIonicons name="chevron-back" size={24} color={arcade.gold} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={[styles.kicker, { fontFamily: runitFont.black }]}>HEAD-TO-HEAD</Text>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>Choose your contest</Text>
      <Text style={styles.sub}>Pick a tier, then a game — we&apos;ll search for a match in that contest.</Text>

      <Text style={styles.sectionLabel}>Contest tier</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tierScroll}>
        {MATCH_ENTRY_TIERS.map((t) => {
          const selected = tier?.entry === t.entry && tier?.prize === t.prize;
          return (
            <Pressable
              key={`${t.entry}-${t.prize}`}
              onPress={() => setTier(t)}
              style={({ pressed }) => [
                styles.tierChip,
                selected && styles.tierChipOn,
                pressed && !selected && { opacity: 0.9 },
              ]}
            >
              <SafeIonicons name={t.icon} size={18} color={selected ? '#fff' : 'rgba(203,213,225,0.95)'} />
              <Text style={[styles.tierChipLbl, selected && styles.tierChipLblOn]}>{t.shortLabel}</Text>
              <Text style={[styles.tierChipMeta, selected && styles.tierChipMetaOn]}>
                ${t.entry} → ${t.prize}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tier ? (
        <>
          <View style={styles.tierSummary}>
            <View style={styles.tierSummaryCol}>
              <Text style={styles.tierSummaryLbl}>Match access</Text>
              <Text style={styles.tierSummaryAmt}>{entryLabel}</Text>
            </View>
            <View style={styles.tierSummaryRule} />
            <View style={[styles.tierSummaryCol, styles.tierSummaryColPrize]}>
              <Text style={styles.tierSummaryPrizeLbl}>🏆 Top performer prize</Text>
              <Text style={styles.tierSummaryPrizeAmt}>{prizeLabel}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Game</Text>
          <Text style={styles.gameHint}>Tap a game — we queue you for a fair opponent on this tier.</Text>

          <View style={styles.list}>
            {H2H_OPEN_GAMES.map((g) => (
              <ArcadeGameRow
                key={g.gameKey}
                title={g.title}
                entryLabel="Head-to-head · this contest tier"
                winLabel="Find match"
                bgColors={g.bgColors}
                borderAccent={g.borderAccent}
                iconSlot={gameIcon(g.gameKey, 38)}
                emphasized
                compact
                onPress={() => goQueue(g.gameKey)}
                titleColor={g.gameKey === 'dash-duel' ? '#e2e8f0' : '#fff'}
                entryColor={g.gameKey === 'dash-duel' ? 'rgba(148,163,184,0.95)' : 'rgba(226,232,240,0.9)'}
              />
            ))}
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <SafeIonicons name="arrow-up" size={22} color="rgba(148,163,184,0.7)" />
          <Text style={styles.placeholderTxt}>Select a tier above to choose your game</Text>
        </View>
      )}
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
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  sub: {
    color: 'rgba(203,213,225,0.88)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  sectionLabel: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  tierScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 4,
    paddingRight: 8,
  },
  tierChip: {
    width: 108,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderWidth: 2,
    borderColor: 'rgba(148,163,184,0.28)',
    alignItems: 'center',
    gap: 4,
  },
  tierChipOn: {
    borderColor: runit.neonPink,
    backgroundColor: 'rgba(255,0,110,0.12)',
    shadowColor: runit.neonPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  tierChipLbl: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 12,
    fontWeight: '900',
  },
  tierChipLblOn: { color: '#fff' },
  tierChipMeta: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 10,
    fontWeight: '700',
  },
  tierChipMetaOn: { color: 'rgba(254,243,199,0.95)' },
  tierSummary: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 14,
    marginTop: 6,
    marginHorizontal: 4,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    backgroundColor: 'rgba(15,23,42,0.75)',
  },
  tierSummaryCol: {
    flex: 1,
    paddingVertical: 10,
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
    marginBottom: 4,
  },
  tierSummaryAmt: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  tierSummaryRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginVertical: 8,
  },
  tierSummaryPrizeLbl: {
    color: 'rgba(254,243,199,0.95)',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  tierSummaryPrizeAmt: {
    color: '#FDE047',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  gameHint: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 17,
  },
  list: { paddingBottom: 24 },
  placeholder: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  placeholderTxt: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
