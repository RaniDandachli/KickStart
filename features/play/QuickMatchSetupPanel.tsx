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
import { ENABLE_BACKEND, SHOW_H2H_COMING_SOON_MODE_CARDS } from '@/constants/featureFlags';
import { useFloatingOnlineCount } from '@/hooks/useFloatingOnlineCount';
import type { HomeLobbyStats } from '@/services/api/homeLobby';
import { H2H_OPEN_GAMES, type H2hGameKey } from '@/lib/homeOpenMatches';
import { formatUsdFromCents } from '@/lib/money';
import {
  prizeUsdCentsForContestEntryCents,
  QUICK_MATCH_KNOWN_ENTRY_CENTS,
} from '@/lib/quickMatchTiers';
import { runit, runitFont } from '@/lib/runitArcadeTheme';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

const ENTRY_FEE_POPULAR_CENTS = 500;

const GAME_MODES = [
  { key: '1v1', title: '1v1', subtitle: 'Head to Head', enabled: true as const, popular: true as const },
  { key: '3p', title: '3-Player', subtitle: 'Battle', enabled: false as const, popular: false as const },
  { key: 'cl', title: 'Classic', subtitle: 'Same rules', enabled: false as const, popular: false as const },
] as const;

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

function formatEntryFeeUsd(entryCents: number): string {
  if (entryCents <= 0) return 'FREE';
  const usd = entryCents / 100;
  if (Number.isInteger(usd)) return `$${usd}`;
  return `$${usd.toFixed(2)}`;
}

export type QuickMatchSetupPanelProps = {
  lobby: HomeLobbyStats | null | undefined;
  maxAffordableEntryCents: number;
  selectedEntryCents: readonly number[];
  onSelectEntryFee: (entryCents: number) => void;
  onStartSearch: () => void;
  onOpenHowItWorks?: () => void;
  onHomePickEntryFee?: () => void;
  onArcadePractice?: () => void;
  keepSearchingWhenAway: boolean;
  onKeepSearchingChange: (v: boolean) => void;
  pingOpenQueueAlerts: boolean;
  onPingOpenQueueAlertsChange: (v: boolean) => void;
  showNotificationSettings: boolean;
  isWebPushConfigured: boolean;
};

export function QuickMatchSetupPanel({
  lobby,
  maxAffordableEntryCents,
  selectedEntryCents,
  onSelectEntryFee,
  onStartSearch,
  onOpenHowItWorks,
  onHomePickEntryFee,
  onArcadePractice,
  keepSearchingWhenAway,
  onKeepSearchingChange,
  pingOpenQueueAlerts,
  onPingOpenQueueAlertsChange,
  showNotificationSettings,
  isWebPushConfigured,
}: QuickMatchSetupPanelProps) {
  const [gameModalOpen, setGameModalOpen] = useState(false);
  /** Cosmetic only — Quick Match still pairs across the live pool; we show what you prefer to play. */
  const [preferredGame, setPreferredGame] = useState<H2hGameKey | null>(null);
  const floatOnline = useFloatingOnlineCount(4000);

  const playersOnline =
    ENABLE_BACKEND && lobby != null ? String(lobby.players_online) : String(floatOnline);
  const starting = lobby != null ? String(lobby.matches_queued) : '—';
  const liveMatches = lobby != null ? String(lobby.matches_in_progress) : '—';
  const rewards24h =
    lobby != null && lobby.rewards_wallet_cents_24h > 0
      ? formatUsdFromCents(lobby.rewards_wallet_cents_24h)
      : '—';

  const primaryEntryCents = selectedEntryCents.length ? selectedEntryCents[0]! : 0;
  const payCents = primaryEntryCents;
  const winCents = prizeUsdCentsForContestEntryCents(primaryEntryCents);
  const payLabel = payCents <= 0 ? '$0.00' : formatUsdFromCents(payCents);
  const winLabel = winCents <= 0 ? '$0.00' : formatUsdFromCents(winCents);

  const previewTitle =
    preferredGame == null
      ? 'Any skill game'
      : H2H_OPEN_GAMES.find((g) => g.gameKey === preferredGame)?.title ?? 'Game';
  const previewSub = '1v1 match';

  function onHelpPress() {
    if (onOpenHowItWorks) onOpenHowItWorks();
    else {
      Alert.alert(
        'Quick Match',
        'Pick an entry fee (including free practice). We search the live queue for someone on a tier you allow. When paired, you both play the same minigame contest — higher score wins.',
      );
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.statusStrip}>
        <View style={styles.statusLeft}>
          <View style={styles.statusDotRow}>
            <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.statusTxt}>{playersOnline} online</Text>
          </View>
          <Text style={styles.statusSep}>·</Text>
          <View style={styles.statusDotRow}>
            <View style={[styles.dot, { backgroundColor: '#94a3b8' }]} />
            <Text style={styles.statusTxt}>{starting} starting</Text>
          </View>
          <Text style={styles.statusSep}>·</Text>
          <View style={styles.statusDotRow}>
            <View style={[styles.dot, { backgroundColor: runit.neonPink }]} />
            <Text style={styles.statusTxt}>{liveMatches} live</Text>
          </View>
        </View>
        <View style={styles.statusRight}>
          <Text style={styles.rewardsTxt} numberOfLines={1}>
            {rewards24h} rewards
          </Text>
          <Text style={styles.rewards24}>24h</Text>
          <Pressable onPress={onHelpPress} hitSlop={10} accessibilityLabel="Quick match help">
            <SafeIonicons name="help-circle-outline" size={20} color="rgba(148,163,184,0.95)" />
          </Pressable>
        </View>
      </View>

      <View style={styles.headRow}>
        <View style={styles.headLeft}>
          <View style={styles.titleRow}>
            <SafeIonicons name="flash" size={26} color={runit.neonPurple} />
            <Text style={[styles.screenTitle, { fontFamily: runitFont.black }]}>Quick Match</Text>
          </View>
          <Text style={styles.screenSub}>Jump into a match quickly. We&apos;ll find an opponent for you.</Text>
        </View>
        <Pressable
          onPress={() => onOpenHowItWorks?.()}
          disabled={!onOpenHowItWorks}
          style={({ pressed }) => [styles.howBox, !onOpenHowItWorks && { opacity: 0.65 }, pressed && onOpenHowItWorks && { opacity: 0.88 }]}
        >
          <Text style={[styles.howBoxTitle, { fontFamily: runitFont.black }]}>How it works</Text>
          <View style={styles.howFlow}>
            <View style={styles.howStep}>
              <SafeIonicons name="game-controller" size={16} color={runit.neonPurple} />
              <Text style={styles.howStepTxt}>Entry fee</Text>
            </View>
            <SafeIonicons name="arrow-forward" size={12} color="rgba(148,163,184,0.6)" />
            <View style={styles.howStep}>
              <SafeIonicons name="people" size={16} color={runit.neonPurple} />
              <Text style={styles.howStepTxt}>We pair</Text>
            </View>
            <SafeIonicons name="arrow-forward" size={12} color="rgba(148,163,184,0.6)" />
            <View style={styles.howStep}>
              <SafeIonicons name="trophy" size={16} color={runit.neonPurple} />
              <Text style={styles.howStepTxt}>Play</Text>
            </View>
          </View>
        </Pressable>
      </View>

      <View style={styles.stepHeadRow}>
        <View style={styles.stepCircle}>
          <Text style={[styles.stepNum, { fontFamily: runitFont.black }]}>1</Text>
        </View>
        <Text style={[styles.stepHead, { fontFamily: runitFont.black }]}>Pick game & entry fee</Text>
        <Pressable
          onPress={() => setGameModalOpen(true)}
          style={({ pressed }) => [styles.gameDropdown, pressed && { opacity: 0.88 }]}
        >
          <View style={styles.gameDropdownIcon}>
            {preferredGame ? gameIcon(preferredGame, 22) : <SafeIonicons name="apps" size={20} color="#94a3b8" />}
          </View>
          <View style={styles.gameDropdownTxt}>
            <Text style={styles.gameDropdownTitle} numberOfLines={1}>
              {previewTitle}
            </Text>
            <Text style={styles.gameDropdownSub}>{previewSub}</Text>
          </View>
          <SafeIonicons name="chevron-down" size={18} color="rgba(148,163,184,0.85)" />
        </Pressable>
      </View>

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
            {m.popular && m.enabled ? (
              <View style={styles.modePopular}>
                <Text style={styles.modePopularTxt}>POPULAR</Text>
              </View>
            ) : null}
            {m.enabled ? (
              <View style={styles.modeCheck}>
                <SafeIonicons name="checkmark" size={12} color="#0c0618" />
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

      <Text style={[styles.sectionKicker, styles.sectionKickerSp]}>ENTRY FEE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={[styles.hScroll, styles.entryFeeScrollPad]}
      >
        {QUICK_MATCH_KNOWN_ENTRY_CENTS.map((cents) => {
          const disabled = cents > maxAffordableEntryCents;
          const selected = primaryEntryCents === cents;
          const popular = cents === ENTRY_FEE_POPULAR_CENTS && cents > 0;
          const isFree = cents <= 0;
          const winUp = isFree ? 'Practice' : formatUsdFromCents(prizeUsdCentsForContestEntryCents(cents));
          return (
            <Pressable
              key={cents}
              disabled={disabled}
              onPress={() => onSelectEntryFee(cents)}
              style={({ pressed }) => [
                styles.entryFeeCard,
                selected && styles.entryFeeCardOn,
                disabled && styles.entryFeeDisabled,
                pressed && !disabled && { opacity: 0.9 },
              ]}
            >
              {popular ? (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeTxt}>POPULAR</Text>
                </View>
              ) : null}
              {selected ? (
                <View style={styles.entryFeeCheck}>
                  <SafeIonicons name="checkmark" size={12} color="#0c0618" />
                </View>
              ) : null}
              <Text style={styles.entryFeeMain}>{isFree ? 'FREE' : formatEntryFeeUsd(cents)}</Text>
              {isFree ? (
                <Text style={styles.entryFeePracticeLbl}>Practice</Text>
              ) : (
                <Text style={styles.entryFeeWinLbl}>Win up to</Text>
              )}
              <Text style={[styles.entryFeeWinAmt, isFree && styles.entryFeeWinAmtFree]} numberOfLines={1}>
                {winUp}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.poolNote}>
        Pool matches any minigame at this entry fee. Prefer a game? Tap the selector — it helps you remember what you wanted to play.
      </Text>

      <View style={styles.bottomBar}>
        <View style={styles.bottomLeft}>
          <View style={styles.payMiniRow}>
            <Text style={styles.payMiniLbl}>You pay</Text>
            <Text style={styles.payMiniAmt}>{payLabel}</Text>
            <SafeIonicons name="arrow-forward" size={14} color="rgba(148,163,184,0.65)" />
            <Text style={styles.payMiniLbl}>You win</Text>
            <Text style={styles.winMiniAmt}>{winLabel}</Text>
          </View>
          <View style={styles.metaMiniRow}>
            <Text style={styles.metaMini}>Entry {payLabel}</Text>
            <Text style={styles.metaMiniSep}>·</Text>
            <Text style={styles.metaMini}>Platform </Text>
            <Text style={styles.metaMiniGreen}>FREE</Text>
          </View>
        </View>
        <View style={styles.bottomMid}>
          <SafeIonicons name="shield-checkmark" size={18} color="#4ade80" />
          <Text style={styles.fairTxt}>Fair play guaranteed</Text>
        </View>
        <Pressable
          onPress={onStartSearch}
          style={({ pressed }) => [styles.startSearchBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Start search for opponent"
        >
          <SafeIonicons name="search" size={20} color="#fff" />
          <Text style={[styles.startSearchTxt, { fontFamily: runitFont.black }]}>Start search</Text>
        </Pressable>
      </View>

      {showNotificationSettings ? (
        <View style={styles.toggleDeck}>
          <View style={[styles.toggleRow, styles.toggleRowGold]}>
            <View style={styles.toggleRowLeft}>
              <SafeIonicons name="person-outline" size={18} color="rgba(148,163,184,0.9)" />
              <View style={styles.toggleTxtCol}>
                <Text style={styles.toggleTitle}>Keep my spot in queue</Text>
                <Text style={styles.toggleBody}>
                  {Platform.OS === 'web'
                    ? 'Leave this page and keep searching in the background.'
                    : 'Browse the app — we alert you when someone pairs.'}
                </Text>
              </View>
            </View>
            <Switch
              accessibilityLabel="Keep searching in the background"
              value={keepSearchingWhenAway}
              onValueChange={(v) => void onKeepSearchingChange(v)}
              trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(99,102,241,0.55)' }}
              thumbColor={keepSearchingWhenAway ? '#0c0618' : '#64748b'}
              ios_backgroundColor="rgba(255,255,255,0.12)"
            />
          </View>
          <View style={styles.toggleDivider} />
          <View style={[styles.toggleRow, styles.toggleRowPink]}>
            <View style={styles.toggleRowLeft}>
              <SafeIonicons name="notifications-outline" size={18} color="rgba(148,163,184,0.9)" />
              <View style={styles.toggleTxtCol}>
                <Text style={styles.toggleTitle}>Ping me for open queues</Text>
                <Text style={styles.toggleBody}>
                  {Platform.OS === 'web'
                    ? isWebPushConfigured
                      ? 'Browser notifications when a matching queue opens.'
                      : 'Enable web push in your build for browser alerts.'
                    : 'Push when someone is waiting for a contest like your entry fee.'}
                </Text>
              </View>
            </View>
            <Switch
              accessibilityLabel="Notify when someone queues for a matching contest"
              value={pingOpenQueueAlerts}
              onValueChange={(v) => void onPingOpenQueueAlertsChange(v)}
              trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(232,121,249,0.45)' }}
              thumbColor={pingOpenQueueAlerts ? '#f8fafc' : '#64748b'}
              ios_backgroundColor="rgba(255,255,255,0.12)"
            />
          </View>
        </View>
      ) : null}

      <View style={styles.altLinks}>
        {onHomePickEntryFee ? (
          <Pressable onPress={onHomePickEntryFee} hitSlop={6}>
            <Text style={styles.altLink}>Home — fixed contest</Text>
          </Pressable>
        ) : null}
        {onArcadePractice ? (
          <Pressable onPress={onArcadePractice} hitSlop={6}>
            <Text style={styles.altLink}>Arcade — practice</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={gameModalOpen} transparent animationType="fade" onRequestClose={() => setGameModalOpen(false)}>
        <View style={styles.modalWrap}>
          <Pressable style={styles.modalBackdrop} onPress={() => setGameModalOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { fontFamily: runitFont.black }]}>Preferred minigame</Text>
            <Text style={styles.modalSub}>Cosmetic — Quick Match still uses the live cross-game pool.</Text>
            <Pressable
              style={({ pressed }) => [styles.modalRow, preferredGame == null && styles.modalRowOn, pressed && { opacity: 0.9 }]}
              onPress={() => {
                setPreferredGame(null);
                setGameModalOpen(false);
              }}
            >
              <SafeIonicons name="apps" size={22} color={runit.neonPurple} />
              <Text style={styles.modalRowTxt}>Any skill game (fastest)</Text>
              {preferredGame == null ? <SafeIonicons name="checkmark-circle" size={22} color={runit.gold} /> : null}
            </Pressable>
            <ScrollView style={styles.modalList} nestedScrollEnabled>
              {H2H_OPEN_GAMES.map((g) => (
                <Pressable
                  key={g.gameKey}
                  style={({ pressed }) => [
                    styles.modalRow,
                    preferredGame === g.gameKey && styles.modalRowOn,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={() => {
                    setPreferredGame(g.gameKey);
                    setGameModalOpen(false);
                  }}
                >
                  <View style={styles.modalRowIcon}>{gameIcon(g.gameKey, 26)}</View>
                  <Text style={styles.modalRowTxt}>{g.title}</Text>
                  {preferredGame === g.gameKey ? <SafeIonicons name="checkmark-circle" size={22} color={runit.gold} /> : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setGameModalOpen(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CARD = 'rgba(12,12,16,0.95)';
const LINE = 'rgba(255,255,255,0.1)';
const PURPLE = 'rgba(192,132,252,0.9)';

const styles = StyleSheet.create({
  root: { marginBottom: 8 },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(18,18,22,0.92)',
    borderWidth: 1,
    borderColor: LINE,
    marginBottom: 14,
    gap: 8,
  },
  statusLeft: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  statusRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  statusDotRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { color: 'rgba(226,232,240,0.92)', fontSize: 11, fontWeight: '700' },
  statusSep: { color: 'rgba(100,116,139,0.7)', fontSize: 11 },
  rewardsTxt: { color: 'rgba(203,213,225,0.9)', fontSize: 11, fontWeight: '700', maxWidth: 120 },
  rewards24: { color: 'rgba(148,163,184,0.85)', fontSize: 10, fontWeight: '700' },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  headLeft: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  screenTitle: { color: '#f8fafc', fontSize: 24, letterSpacing: 0.5 },
  screenSub: { color: 'rgba(148,163,184,0.95)', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  howBox: {
    width: 168,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: CARD,
  },
  howBoxTitle: { color: '#f1f5f9', fontSize: 11, fontWeight: '900', marginBottom: 8, letterSpacing: 0.5 },
  howFlow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  howStep: { alignItems: 'center', gap: 4, flex: 1 },
  howStepTxt: { color: 'rgba(148,163,184,0.95)', fontSize: 9, fontWeight: '700', textAlign: 'center' },
  stepHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: runit.neonPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { color: '#fff', fontSize: 14, fontWeight: '900' },
  stepHead: { color: '#f8fafc', fontSize: 15, fontWeight: '900', letterSpacing: 0.4, flex: 1, minWidth: 120 },
  gameDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: CARD,
    maxWidth: 200,
  },
  gameDropdownIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  gameDropdownTxt: { flex: 1, minWidth: 0 },
  gameDropdownTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '800' },
  gameDropdownSub: { color: 'rgba(148,163,184,0.9)', fontSize: 10, fontWeight: '600', marginTop: 2 },
  sectionKicker: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  sectionKickerSp: { marginTop: 6 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modeCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: CARD,
    paddingVertical: 12,
    paddingHorizontal: 6,
    position: 'relative',
  },
  modeCardOn: { borderColor: PURPLE, borderWidth: 2, backgroundColor: 'rgba(88,28,135,0.2)' },
  modeCardOff: { opacity: 0.45 },
  modePopular: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: runit.neonPurple,
    zIndex: 2,
  },
  modePopularTxt: { color: '#fff', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  modeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: runit.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSoonPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modeSoonTxt: { color: 'rgba(148,163,184,0.95)', fontSize: 8, fontWeight: '800' },
  modeTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '900', marginTop: 20, marginBottom: 4, textAlign: 'center' },
  modeTitleMuted: { color: 'rgba(226,232,240,0.7)' },
  modeSub: { color: 'rgba(148,163,184,0.92)', fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 13 },
  hScroll: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  entryFeeScrollPad: { paddingTop: 12, paddingBottom: 4 },
  entryFeeCard: {
    width: 92,
    minHeight: 112,
    paddingTop: 18,
    paddingBottom: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: CARD,
    alignItems: 'center',
    position: 'relative',
  },
  entryFeeCardOn: { borderColor: PURPLE, borderWidth: 2, backgroundColor: 'rgba(88,28,135,0.22)' },
  entryFeeDisabled: { opacity: 0.32 },
  popularBadge: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: runit.neonPurple,
    zIndex: 2,
  },
  popularBadgeTxt: { color: '#fff', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  entryFeeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: runit.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryFeeMain: { color: '#f8fafc', fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'], marginBottom: 2 },
  entryFeePracticeLbl: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  entryFeeWinLbl: { color: 'rgba(148,163,184,0.85)', fontSize: 8, fontWeight: '700', marginBottom: 2 },
  entryFeeWinAmt: { color: 'rgba(226,232,240,0.95)', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  entryFeeWinAmtFree: { color: '#86efac', fontSize: 10 },
  poolNote: {
    color: 'rgba(148,163,184,0.82)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    marginBottom: 14,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(8,8,12,0.88)',
    borderWidth: 1,
    borderColor: LINE,
    marginBottom: 14,
  },
  bottomLeft: { flexGrow: 1, flexShrink: 1, minWidth: 140 },
  payMiniRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 },
  payMiniLbl: { color: 'rgba(148,163,184,0.9)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  payMiniAmt: { color: runit.neonPurple, fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  winMiniAmt: { color: '#4ade80', fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metaMiniRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  metaMini: { color: 'rgba(148,163,184,0.85)', fontSize: 10, fontWeight: '600' },
  metaMiniSep: { color: 'rgba(100,116,139,0.6)', fontSize: 10 },
  metaMiniGreen: { color: '#4ade80', fontSize: 10, fontWeight: '900' },
  bottomMid: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 120 },
  fairTxt: { color: 'rgba(148,163,184,0.92)', fontSize: 10, fontWeight: '700', flex: 1 },
  startSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: runit.neonPurple,
  },
  startSearchTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
  toggleDeck: { marginBottom: 12, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: LINE },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 10 },
  toggleRowGold: { backgroundColor: 'rgba(15,12,8,0.55)' },
  toggleRowPink: { backgroundColor: 'rgba(12,8,18,0.55)' },
  toggleRowLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 },
  toggleTxtCol: { flex: 1, minWidth: 0 },
  toggleTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  toggleBody: { color: 'rgba(148,163,184,0.9)', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  toggleDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)' },
  altLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 8 },
  altLink: { color: runit.neonPink, fontSize: 12, fontWeight: '800' },
  modalWrap: { flex: 1, justifyContent: 'center' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalCard: {
    marginHorizontal: 20,
    marginTop: Platform.OS === 'web' ? 40 : 24,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#12121a',
    borderWidth: 1,
    borderColor: LINE,
    maxHeight: '85%' as const,
  },
  modalTitle: { color: '#f8fafc', fontSize: 18, marginBottom: 4 },
  modalSub: { color: 'rgba(148,163,184,0.9)', fontSize: 12, marginBottom: 12, lineHeight: 17 },
  modalList: { maxHeight: 320 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalRowOn: { borderColor: PURPLE, backgroundColor: 'rgba(88,28,135,0.2)' },
  modalRowIcon: { width: 36, alignItems: 'center' },
  modalRowTxt: { flex: 1, color: '#f1f5f9', fontSize: 15, fontWeight: '800' },
  modalClose: { marginTop: 8, alignSelf: 'center', padding: 10 },
  modalCloseTxt: { color: runit.neonPink, fontSize: 14, fontWeight: '800' },
});
