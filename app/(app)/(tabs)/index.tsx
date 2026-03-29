import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomePlayHero } from '@/components/arcade/HomePlayHero';
import { DashDuelGameIcon, TapDashGameIcon, TileClashGameIcon } from '@/components/arcade/MinigameIcons';
import { arcade } from '@/lib/arcadeTheme';
import { useActiveSeason } from '@/hooks/useActiveSeason';
import { useAuthStore } from '@/store/authStore';
import { useProfile } from '@/hooks/useProfile';
import { useTournaments } from '@/hooks/useTournaments';
import { formatTournamentState } from '@/features/tournaments/tournamentPresentation';

/** Subtle hex-grid hint (no image asset). */
function HoneycombTexture() {
  const cells = Array.from({ length: 28 }, (_, i) => i);
  return (
    <View style={styles.hexLayer} pointerEvents="none">
      {cells.map((i) => {
        const col = i % 7;
        const row = Math.floor(i / 7);
        return (
          <View
            key={i}
            style={[
              styles.hexCell,
              {
                left: col * 52 + (row % 2) * 26,
                top: row * 30,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const seasonQ = useActiveSeason();
  const tournamentsQ = useTournaments(true);

  const profile = profileQ.data;
  const nextTournament = tournamentsQ.data?.[0];
  const displayName = profile?.display_name ?? profile?.username ?? 'Player';

  return (
    <LinearGradient colors={[arcade.navy0, '#050a14', arcade.navy1]} style={styles.screenRoot} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <HoneycombTexture />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <HomePlayHero
            onStakePress={(entry, win) =>
              router.push(
                `/(app)/(tabs)/play/casual?entry=${encodeURIComponent(String(entry))}&win=${encodeURIComponent(String(win))}`,
              )
            }
            onQuickMatch={() => router.push('/(app)/(tabs)/play/casual')}
          />

          <Text style={styles.sectionTitle}>Cash games</Text>
          <Text style={styles.sectionSub}>Same three games as Arcade — play for real money vs players</Text>

          {/* Tap Dash */}
          <Pressable style={styles.cardOuter} onPress={() => router.push('/(app)/(tabs)/play/minigames/tap-dash')}>
            <LinearGradient colors={['#1e3a8a', '#2563eb', '#38bdf8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameCard}>
              <View style={styles.gameRow}>
                <View style={styles.gameIconCol}>
                  <TapDashGameIcon size={56} />
                </View>
                <View style={styles.gameTextCol}>
                  <Text style={styles.gameTitle}>Tap Dash</Text>
                  <Text style={styles.gameEntry}>Entry: $1</Text>
                </View>
                <LinearGradient colors={['#4ADE80', '#22C55E', '#15803D']} style={styles.winBtn}>
                  <Text style={styles.winBtnText}>Win $1.80</Text>
                </LinearGradient>
              </View>
            </LinearGradient>
          </Pressable>

          {/* Tile Clash */}
          <Pressable style={styles.cardOuter} onPress={() => router.push('/(app)/(tabs)/play/minigames/tile-clash')}>
            <LinearGradient colors={['#0f172a', '#1e293b', '#334155']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameCard}>
              <View style={styles.gameRow}>
                <View style={styles.gameIconCol}>
                  <TileClashGameIcon size={56} />
                </View>
                <View style={styles.gameTextCol}>
                  <Text style={styles.gameTitle}>Tile Clash</Text>
                  <Text style={styles.gameEntry}>Entry: $2</Text>
                </View>
                <LinearGradient colors={['#38BDF8', '#0284C7', '#0369A1']} style={styles.winBtn}>
                  <Text style={styles.winBtnText}>Win $3.50</Text>
                </LinearGradient>
              </View>
            </LinearGradient>
          </Pressable>

          {/* Dash Duel */}
          <Pressable style={styles.cardOuter} onPress={() => router.push('/(app)/(tabs)/play/minigames/dash-duel')}>
            <LinearGradient colors={['#020617', '#0f172a', '#312e81']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameCard}>
              <View style={styles.gameRow}>
                <View style={styles.gameIconCol}>
                  <DashDuelGameIcon size={56} />
                </View>
                <View style={styles.gameTextCol}>
                  <Text style={styles.gameTitle}>Dash Duel</Text>
                  <Text style={styles.gameEntry}>Entry: $5</Text>
                </View>
                <LinearGradient colors={['#22D3EE', '#0891B2', '#0E7490']} style={styles.winBtn}>
                  <Text style={styles.winBtnText}>Win $8.50</Text>
                </LinearGradient>
              </View>
            </LinearGradient>
          </Pressable>

          <Text style={styles.sectionTitle}>Live Tournament</Text>

          <Pressable style={styles.cardOuterGlow} onPress={() => router.push('/(app)/(tabs)/tournaments')}>
            <LinearGradient colors={['#1a0f05', '#292524', '#0f172a']} style={styles.tourneyCard}>
              <View style={styles.tourneyRow}>
                <View style={styles.tourneyLeft}>
                  <Text style={styles.bigTrophy}>🏆</Text>
                  <Text style={styles.cashSmall}>💵</Text>
                </View>
                <View style={styles.tourneyMid}>
                  <Text style={styles.tourneyTitle} numberOfLines={2}>
                    {nextTournament?.name ?? '$100 Daily Tournament'}
                  </Text>
                  <Text style={styles.tourneyMeta}>
                    {nextTournament
                      ? `Entry: ${nextTournament.entry_cost_credits} cr · ${nextTournament.current_player_count}/${nextTournament.max_players} players · ${formatTournamentState(nextTournament.state)}`
                      : 'Entry: $5 · Players: 18/20'}
                  </Text>
                </View>
                <LinearGradient colors={['#F97316', '#DC2626']} style={styles.joinBtn}>
                  <Text style={styles.joinBtnText}>JOIN NOW</Text>
                </LinearGradient>
              </View>
            </LinearGradient>
          </Pressable>

          <Text style={styles.sectionTitle}>Your Stats</Text>

          <View style={styles.cardOuterGold}>
            <View style={styles.statsCard}>
              <View style={styles.statsTop}>
                <View style={styles.statsNumbers}>
                  <StatBox label="Wins" value="2" />
                  <StatBox label="Loss" value="1" />
                  <StatBox label="Streak" value="3" />
                </View>
                <View style={styles.rankBadge}>
                  <LinearGradient colors={['#FDE68A', '#D97706', '#92400E']} style={styles.shield}>
                    <Ionicons name="star" size={22} color="#FFFBEB" />
                    <Text style={styles.rankText}>Challenger III</Text>
                  </LinearGradient>
                  <View style={styles.seasonalRibbon}>
                    <Text style={styles.seasonalText}>SEASONAL</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.statsFoot}>Hey {displayName} — climb the board this season.</Text>
              <Pressable style={styles.statsJoinRow} onPress={() => router.push('/(app)/(tabs)/prizes')}>
                <Ionicons name="trophy-outline" size={16} color={arcade.gold} />
                <Text style={styles.statsJoinText}>JOIN NOW</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.seasonCard}>
            {seasonQ.isLoading ? (
              <Text style={styles.muted}>Loading season…</Text>
            ) : seasonQ.data ? (
              <>
                <Text style={styles.seasonName}>{seasonQ.data.name}</Text>
                <Text style={styles.muted}>Ends {new Date(seasonQ.data.ends_at).toLocaleDateString()}</Text>
              </>
            ) : (
              <Text style={styles.muted}>Season info when synced</Text>
            )}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 14, paddingBottom: 100, paddingTop: 6 },
  hexLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    opacity: 0.35,
  },
  hexCell: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.12)',
    transform: [{ rotate: '30deg' }],
  },
  cardOuterGold: {
    borderRadius: 18,
    padding: 2,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(212, 165, 116, 0.85)',
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  cardOuter: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(212, 165, 116, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  cardOuterGlow: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FBBF24',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  sectionTitle: {
    color: arcade.white,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  sectionSub: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 17,
  },
  gameCard: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 88,
    justifyContent: 'center',
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gameIconCol: { width: 56, alignItems: 'center', justifyContent: 'center' },
  gameTextCol: { flex: 1 },
  gameTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    fontStyle: 'italic',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  stackTitle: { color: '#292524' },
  gameEntry: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '700' },
  gameEntryDark: { color: 'rgba(41, 37, 36, 0.95)', fontSize: 13, fontWeight: '700' },
  winBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    minWidth: 96,
    alignItems: 'center',
  },
  winBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  tourneyCard: {
    padding: 14,
    borderRadius: 14,
  },
  tourneyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tourneyLeft: { flexDirection: 'row', alignItems: 'flex-end' },
  bigTrophy: { fontSize: 40 },
  cashSmall: { fontSize: 18, marginLeft: -8, marginBottom: 4 },
  tourneyMid: { flex: 1 },
  tourneyTitle: {
    color: '#FDE68A',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  tourneyMeta: { color: 'rgba(226, 232, 240, 0.9)', fontSize: 12, fontWeight: '600' },
  joinBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  joinBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  statsCard: {
    backgroundColor: 'rgba(6, 13, 24, 0.92)',
    borderRadius: 16,
    padding: 14,
  },
  statsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statsNumbers: { flexDirection: 'row', gap: 20 },
  statBox: { alignItems: 'flex-start' },
  statVal: { color: arcade.white, fontSize: 22, fontWeight: '900' },
  statLbl: { color: arcade.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  rankBadge: { alignItems: 'center' },
  shield: {
    width: 88,
    height: 96,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  rankText: {
    color: '#FFFBEB',
    fontSize: 9,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },
  seasonalRibbon: {
    marginTop: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  seasonalText: { color: '#E2E8F0', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  statsFoot: { color: arcade.textMuted, fontSize: 12, marginBottom: 10 },
  statsJoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.5)',
    backgroundColor: 'rgba(212, 165, 116, 0.08)',
  },
  statsJoinText: { color: arcade.gold, fontWeight: '900', fontSize: 12 },
  seasonCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    backgroundColor: 'rgba(15, 40, 71, 0.35)',
  },
  seasonName: { color: arcade.white, fontWeight: '800', fontSize: 15 },
  muted: { color: arcade.textMuted, fontSize: 13 },
});
