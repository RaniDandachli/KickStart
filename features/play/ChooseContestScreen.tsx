import { type MatchEntryTier, MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import {
  BallRunGameIcon,
  DashDuelGameIcon,
  NeonDanceGameIcon,
  NeonGridGameIcon,
  NeonShipGameIcon,
  ShapeDashGameIcon,
  TapDashGameIcon,
  TileClashGameIcon,
  TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND, SHOW_H2H_COMING_SOON_MODE_CARDS } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { supportsClientAsyncHostQueue } from '@/lib/h2hSkillContestGames';
import { H2H_OPEN_GAMES, type H2hGameKey } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const ENTRY_FEE_POPULAR_USD = 5;

const GAME_MODES = [
  { key: '1v1', title: '1v1', subtitle: 'Head to Head', enabled: true as const },
  { key: '3p', title: '3-Player', subtitle: 'Battle', enabled: false as const },
  { key: 'classic', title: 'Classic', subtitle: 'Same rules', enabled: false as const },
] as const;

function tierKey(t: MatchEntryTier) {
  return `${t.entry}-${t.prize}`;
}

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
    case 'neon-dance':
      return <NeonDanceGameIcon size={size} />;
    case 'neon-grid':
      return <NeonGridGameIcon size={size} />;
    case 'neon-ship':
      return <NeonShipGameIcon size={size} />;
    case 'shape-dash':
      return <ShapeDashGameIcon size={size} />;
    case 'cyber-road':
      return <DashDuelGameIcon size={size} />;
    default:
      return <TapDashGameIcon size={size} />;
  }
}

export type ChooseContestScreenProps = {
  /** When true, primary CTA opens async score lock (no live queue). */
  asyncRunMode?: boolean;
};

/**
 * Start a 1v1 match: pick game, then entry fee (wallet access + listed win). Opens casual queue with auto-search.
 * With `asyncRunMode`, same picker routes to async contest submit instead of live matchmaking.
 */
export function ChooseContestScreen({ asyncRunMode = false }: ChooseContestScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(ENABLE_BACKEND && uid ? uid : undefined);
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = typeof rawReturnTo === 'string' && rawReturnTo.startsWith('/') ? rawReturnTo : undefined;

  const defaultTier = useMemo(
    () => MATCH_ENTRY_TIERS.find((t) => t.entry === ENTRY_FEE_POPULAR_USD) ?? MATCH_ENTRY_TIERS[0]!,
    [],
  );

  const [selectedGame, setSelectedGame] = useState<H2hGameKey | null>(null);
  const [tier, setTier] = useState<MatchEntryTier>(defaultTier);

  const gameList = useMemo(
    () => (asyncRunMode ? H2H_OPEN_GAMES.filter((g) => supportsClientAsyncHostQueue(g.gameKey)) : H2H_OPEN_GAMES),
    [asyncRunMode],
  );

  const selectedMeta = selectedGame ? gameList.find((g) => g.gameKey === selectedGame) : undefined;
  const walletLabel =
    ENABLE_BACKEND && uid && profileQ.data
      ? formatUsdFromCents(profileQ.data.wallet_cents ?? 0)
      : null;

  const payCents = Math.round(tier.entry * 100);
  const winCents = Math.round(tier.prize * 100);
  const payLabel = formatUsdFromCents(payCents);
  const winLabel = formatUsdFromCents(winCents);

  function findMatch() {
    if (!selectedGame) {
      Alert.alert('Pick a game', 'Choose which minigame you want to play first.');
      return;
    }
    if (!ENABLE_BACKEND || uid == null) {
      Alert.alert(
        'Sign in required',
        asyncRunMode
          ? 'Async runs use your signed-in account and cash wallet. Sign in and try again.'
          : 'Head-to-head matchmaking needs a signed-in account. Sign in and try again.',
      );
      return;
    }
    const ec = payCents;
    const pc = winCents;
    const e = encodeURIComponent(String(tier.entry));
    const p = encodeURIComponent(String(tier.prize));
    const g = encodeURIComponent(selectedGame);
    const rt = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : '';
    if (asyncRunMode) {
      router.replace(
        `/(app)/(tabs)/play/contest-async-submit?asyncStake=1&gameKey=${g}&h2hMode=casual&entryCents=${ec}&prizeCents=${pc}${rt}` as never,
      );
      return;
    }
    router.replace(
      `/(app)/(tabs)/play/casual?entryCents=${ec}&prizeCents=${pc}&entry=${e}&prize=${p}&game=${g}&intent=start&autoStart=1${rt}` as never,
    );
  }

  return (
    <Screen>
      <Pressable
        onPress={() => (returnTo ? router.replace(returnTo as never) : router.back())}
        style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.75 }]}
        hitSlop={12}
      >
        <SafeIonicons name="chevron-back" size={22} color="#e2e8f0" />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.screenTitle, { fontFamily: runitFont.black }]}>
            {asyncRunMode ? 'ASYNC RUN' : 'START MATCH'}
          </Text>
          <Text style={styles.screenSub}>
            {asyncRunMode
              ? 'Pick game & entry fee — play solo, compare when someone joins this tier'
              : 'Choose your game and entry fee'}
          </Text>
        </View>
        {selectedMeta ? (
          <View style={styles.previewCard}>
            <View style={styles.previewIcon}>{gameIcon(selectedMeta.gameKey, 28)}</View>
            <View style={styles.previewTxt}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedMeta.title}
              </Text>
              <Text style={styles.previewSub}>{asyncRunMode ? 'Async score' : '1v1 match'}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.previewCard, styles.previewCardDim]}>
            <SafeIonicons name="game-controller-outline" size={24} color="rgba(148,163,184,0.5)" />
            <Text style={styles.previewPlaceholder}>Game</Text>
          </View>
        )}
      </View>

      {walletLabel ? (
        <View style={styles.walletRow}>
          <SafeIonicons name="wallet-outline" size={16} color="rgba(148,163,184,0.95)" />
          <Text style={styles.walletLbl}>Cash wallet</Text>
          <Text style={styles.walletAmt}>{walletLabel}</Text>
        </View>
      ) : null}

      {!asyncRunMode ? (
        <>
          <Text style={styles.sectionKicker}>GAME MODE</Text>
          <View style={styles.modeRow}>
            {GAME_MODES.filter((m) => SHOW_H2H_COMING_SOON_MODE_CARDS || m.key === '1v1').map((m) => (
              <View
                key={m.key}
                style={[
                  styles.modeCard,
                  m.enabled && styles.modeCardOn,
                  !m.enabled && styles.modeCardOff,
                ]}
              >
                {m.enabled ? (
                  <View style={styles.modeCheck}>
                    <SafeIonicons name="checkmark" size={14} color="#0c0618" />
                  </View>
                ) : (
                  <View style={styles.modeSoonPill}>
                    <Text style={styles.modeSoonTxt}>Soon</Text>
                  </View>
                )}
                <Text style={[styles.modeTitle, !m.enabled && styles.modeTitleMuted]}>{m.title}</Text>
                <Text style={styles.modeSub} numberOfLines={2}>
                  {m.subtitle}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={[styles.sectionKicker, styles.sectionKickerSp]}>GAME</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.hScroll}
      >
        {gameList.map((g) => {
          const on = selectedGame === g.gameKey;
          return (
            <Pressable
              key={g.gameKey}
              onPress={() => setSelectedGame(g.gameKey)}
              style={({ pressed }) => [
                styles.gameCard,
                on && styles.gameCardOn,
                pressed && { opacity: 0.92 },
              ]}
            >
              {on ? (
                <View style={styles.gameCheck}>
                  <SafeIonicons name="checkmark" size={12} color="#0c0618" />
                </View>
              ) : null}
              <View style={styles.gameIconWrap}>{gameIcon(g.gameKey, 34)}</View>
              <Text style={styles.gameTitle} numberOfLines={2}>
                {g.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionKicker, styles.sectionKickerSp]}>ENTRY FEE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={[styles.hScroll, styles.entryFeeScrollPad]}
      >
        {MATCH_ENTRY_TIERS.map((t) => {
          const selected = tierKey(tier) === tierKey(t);
          const popular = t.entry === ENTRY_FEE_POPULAR_USD;
          const winUp = formatUsdFromCents(Math.round(t.prize * 100));
          const entryWhole = t.entry >= 1 && Number.isInteger(t.entry) ? String(Math.round(t.entry)) : String(t.entry);
          return (
            <Pressable
              key={tierKey(t)}
              onPress={() => setTier(t)}
              style={({ pressed }) => [styles.entryFeeCard, selected && styles.entryFeeCardOn, pressed && { opacity: 0.92 }]}
            >
              {popular ? (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeTxt}>POPULAR</Text>
                </View>
              ) : null}
              {selected ? (
                <View style={styles.entryFeeCheckAbs}>
                  <SafeIonicons name="checkmark" size={12} color="#0c0618" />
                </View>
              ) : null}
              <Text style={styles.entryFeeDollar}>${entryWhole}</Text>
              <Text style={styles.entryFeeWinLbl}>Win up to</Text>
              <Text style={styles.entryFeeWinAmt}>{winUp}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.payRow}>
        <View style={styles.payCol}>
          <Text style={styles.payLbl}>YOU PAY</Text>
          <Text style={styles.payAmt}>{payLabel}</Text>
        </View>
        <SafeIonicons name="arrow-forward" size={18} color="rgba(148,163,184,0.75)" />
        <View style={styles.payCol}>
          <Text style={styles.payLbl}>YOU WIN</Text>
          <Text style={styles.winAmt}>{winLabel}</Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLbl}>Entry fee</Text>
        <Text style={styles.metaVal}>{payLabel}</Text>
        <Text style={styles.metaLbl}>Platform fee</Text>
        <View style={styles.metaFeeFree}>
          <Text style={styles.metaValGreen}>FREE</Text>
          <SafeIonicons name="information-circle-outline" size={14} color="rgba(148,163,184,0.85)" />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.trustCol}>
          <SafeIonicons name="shield-checkmark" size={18} color="#4ade80" />
          <Text style={styles.trustTxt}>
            {asyncRunMode
              ? 'Async: your score is stored for this contest row until an opponent completes their run on the same tier — then we compare and settle.'
              : 'Fair play: same game and rules for both players. Skill-based scoring on every match.'}
          </Text>
        </View>
        <Pressable
          onPress={findMatch}
          disabled={!selectedGame}
          style={({ pressed }) => [
            styles.findBtn,
            asyncRunMode && styles.findBtnAsync,
            !selectedGame && styles.findBtnDisabled,
            pressed && selectedGame && { opacity: 0.9 },
          ]}
        >
          {asyncRunMode ? (
            <>
              <SafeIonicons name="flash" size={18} color="#fff" />
              <Text style={[styles.findBtnTxt, styles.findBtnTxtFlex, { fontFamily: runitFont.black }]}>Start an Async Run</Text>
              <SafeIonicons name="chevron-forward" size={20} color="#fff" />
            </>
          ) : (
            <>
              <SafeIonicons name="flash" size={18} color="#fff" />
              <Text style={[styles.findBtnTxt, { fontFamily: runitFont.black }]}>Find match</Text>
            </>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const CARD_BG = 'rgba(15,15,18,0.92)';
const BORDER = 'rgba(255,255,255,0.1)';
const PURPLE_ON = 'rgba(192,132,252,0.85)';

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 14,
    gap: 4,
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  screenTitle: {
    color: '#f8fafc',
    fontSize: 22,
    letterSpacing: 1,
    marginBottom: 4,
  },
  screenSub: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 13,
    fontWeight: '600',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    maxWidth: 160,
  },
  previewCardDim: {
    justifyContent: 'center',
    gap: 6,
    minHeight: 64,
    opacity: 0.85,
  },
  previewIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  previewTxt: { flex: 1, minWidth: 0 },
  previewTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  previewSub: { color: 'rgba(148,163,184,0.9)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  previewPlaceholder: { color: 'rgba(148,163,184,0.65)', fontSize: 12, fontWeight: '700' },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(8,8,12,0.65)',
    borderWidth: 1,
    borderColor: BORDER,
    alignSelf: 'flex-start',
  },
  walletLbl: { color: 'rgba(148,163,184,0.9)', fontSize: 12, fontWeight: '700' },
  walletAmt: { color: '#4ade80', fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  sectionKicker: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  sectionKickerSp: { marginTop: 4 },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  modeCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    paddingVertical: 12,
    paddingHorizontal: 8,
    position: 'relative',
  },
  modeCardOn: {
    borderColor: PURPLE_ON,
    borderWidth: 2,
    backgroundColor: 'rgba(88,28,135,0.22)',
  },
  modeCardOff: { opacity: 0.48 },
  modeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: runit.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSoonPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modeSoonTxt: { color: 'rgba(148,163,184,0.95)', fontSize: 9, fontWeight: '800' },
  modeTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '900', marginTop: 18, marginBottom: 4 },
  modeTitleMuted: { color: 'rgba(226,232,240,0.75)' },
  modeSub: { color: 'rgba(148,163,184,0.92)', fontSize: 11, fontWeight: '600', lineHeight: 14 },
  hScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 4,
    paddingRight: 4,
  },
  entryFeeScrollPad: { paddingTop: 12 },
  gameCard: {
    width: 108,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    alignItems: 'center',
  },
  gameCardOn: {
    borderColor: PURPLE_ON,
    borderWidth: 2,
    backgroundColor: 'rgba(88,28,135,0.2)',
  },
  gameCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: runit.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameIconWrap: { marginBottom: 8 },
  gameTitle: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 15,
  },
  entryFeeCard: {
    width: 96,
    minHeight: 118,
    paddingBottom: 10,
    paddingHorizontal: 6,
    paddingTop: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    position: 'relative' as const,
  },
  entryFeeCardOn: {
    borderColor: PURPLE_ON,
    borderWidth: 2,
    backgroundColor: 'rgba(88,28,135,0.2)',
  },
  popularBadge: {
    position: 'absolute' as const,
    top: -8,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: runit.neonPurple,
    zIndex: 2,
  },
  popularBadgeTxt: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  entryFeeCheckAbs: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: runit.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  entryFeeDollar: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  entryFeeWinLbl: { color: 'rgba(148,163,184,0.9)', fontSize: 9, fontWeight: '700', marginBottom: 2 },
  entryFeeWinAmt: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 20,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(8,8,12,0.72)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  payCol: { alignItems: 'center', minWidth: 100 },
  payLbl: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  payAmt: {
    color: runit.neonPurple,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  winAmt: {
    color: '#4ade80',
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  metaLbl: { color: 'rgba(148,163,184,0.85)', fontSize: 12, fontWeight: '700' },
  metaVal: { color: '#f8fafc', fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'], marginRight: 12 },
  metaFeeFree: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaValGreen: { color: '#4ade80', fontSize: 12, fontWeight: '900' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 28,
  },
  trustCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
    minWidth: 0,
  },
  trustTxt: {
    flex: 1,
    color: 'rgba(148,163,184,0.92)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  findBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: runit.neonPurple,
    minWidth: 148,
  },
  findBtnAsync: {
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'stretch',
  },
  findBtnDisabled: { opacity: 0.38 },
  findBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  findBtnTxtFlex: { flex: 1, textAlign: 'center' },
});
