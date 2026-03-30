import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeadToHeadPlayModal } from '@/components/arcade/HeadToHeadPlayModal';
import { HomeNeonBackground } from '@/components/arcade/HomeNeonBackground';
import { HomePlayHero } from '@/components/arcade/HomePlayHero';
import {
  BallRunGameIcon,
  DashDuelGameIcon,
  TapDashGameIcon,
  TileClashGameIcon,
  TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { formatTournamentState } from '@/features/tournaments/tournamentPresentation';
import { useActiveSeason } from '@/hooks/useActiveSeason';
import { useProfile } from '@/hooks/useProfile';
import { useTournaments } from '@/hooks/useTournaments';
import { useWalletDisplayCents } from '@/hooks/useWalletDisplayCents';
import { formatUsdFromCents } from '@/lib/money';
import { runit, runitFont, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';

export default function HomeScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const seasonQ = useActiveSeason();
  const tournamentsQ = useTournaments(true);

  const profile = profileQ.data;
  const nextTournament = tournamentsQ.data?.[0];
  const displayName = profile?.display_name ?? profile?.username ?? 'Player';

  const walletCents = useWalletDisplayCents();
  const walletDisplay = formatUsdFromCents(walletCents);
  const [h2hGate, setH2hGate] = useState<{
    path: string;
    title: string;
    entryUsd: number;
    prizeUsd: number;
  } | null>(null);

  return (
    <LinearGradient colors={['#06020e', '#12081f', '#0c0618', '#050208']} locations={[0, 0.35, 0.65, 1]} style={styles.screenRoot} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
      <StatusBar style="light" />
      <HomeNeonBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <HomePlayHero
            walletDisplay={walletDisplay}
            onEntryTierPress={(entry, prize) =>
              router.push(
                `/(app)/(tabs)/play/casual?entry=${encodeURIComponent(String(entry))}&prize=${encodeURIComponent(String(prize))}`,
              )
            }
            onQuickMatch={() => router.push('/(app)/(tabs)/play/casual')}
          />

          <View style={styles.sectionLabel}>
            <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>HEAD-TO-HEAD</Text>
            <View style={styles.sectionLine} />
          </View>
          <Text style={styles.sectionSub}>Entry fee vs players — winner receives the listed prize</Text>

          {[
            {
              title: 'Tap Dash',
              entryUsd: 1,
              prizeUsd: 1.8,
              entryLabel: '$1',
              prizeLabel: '$1.80',
              icon: <TapDashGameIcon size={48} />,
              route: '/(app)/(tabs)/play/minigames/tap-dash',
              c1: '#1e1b4b',
              c2: '#4c1d95',
            },
            {
              title: 'Tile Clash',
              entryUsd: 2,
              prizeUsd: 3.5,
              entryLabel: '$2',
              prizeLabel: '$3.50',
              icon: <TileClashGameIcon size={48} />,
              route: '/(app)/(tabs)/play/minigames/tile-clash',
              c1: '#0f172a',
              c2: '#5b21b6',
            },
            {
              title: 'Dash Duel',
              entryUsd: 5,
              prizeUsd: 8.5,
              entryLabel: '$5',
              prizeLabel: '$8.50',
              icon: <DashDuelGameIcon size={48} />,
              route: '/(app)/(tabs)/play/minigames/dash-duel',
              c1: '#020617',
              c2: '#0c4a6e',
            },
            {
              title: 'Neon Ball Run',
              entryUsd: 3,
              prizeUsd: 5,
              entryLabel: '$3',
              prizeLabel: '$5.00',
              icon: <BallRunGameIcon size={48} />,
              route: '/(app)/(tabs)/play/minigames/ball-run',
              c1: '#1a0b2e',
              c2: '#831843',
            },
            {
              title: 'Turbo Arena',
              entryUsd: 3,
              prizeUsd: 5,
              entryLabel: '$3',
              prizeLabel: '$5.00',
              icon: <TurboArenaGameIcon size={48} />,
              route: '/(app)/(tabs)/play/minigames/turbo-arena',
              c1: '#020617',
              c2: '#7c2d12',
            },
          ].map((g) => (
            <Pressable
              key={g.title}
              style={({ pressed }) => [styles.gameWrap, pressed && { opacity: 0.9 }]}
              onPress={() =>
                setH2hGate({
                  path: g.route,
                  title: g.title,
                  entryUsd: g.entryUsd,
                  prizeUsd: g.prizeUsd,
                })
              }
            >
              <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameBorder}>
                <LinearGradient colors={[g.c1, g.c2]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.gameCard}>
                  <View style={styles.gameRow}>
                    <View style={styles.gameIconCol}>{g.icon}</View>
                    <View style={styles.gameTextCol}>
                      <Text style={[styles.gameTitle, runitTextGlowPink]}>{g.title}</Text>
                      <Text style={styles.gameEntry}>Entry {g.entryLabel}</Text>
                    </View>
                    <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.prizeBtn}>
                      <Text style={styles.prizeBtnText}>Prize {g.prizeLabel}</Text>
                    </LinearGradient>
                  </View>
                </LinearGradient>
              </LinearGradient>
            </Pressable>
          ))}

          <View style={[styles.sectionLabel, { marginTop: 8 }]}>
            <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>LIVE EVENT</Text>
            <View style={styles.sectionLine} />
          </View>

          <Pressable style={({ pressed }) => [styles.gameWrap, pressed && { opacity: 0.9 }]} onPress={() => router.push('/(app)/(tabs)/tournaments')}>
            <LinearGradient colors={[runit.neonPurple, runit.neonPink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameBorder}>
              <View style={styles.tourneyCard}>
                <View style={styles.trophyIcon} accessibilityLabel="Tournament">
                  <Ionicons name="trophy" size={34} color="#fbbf24" />
                </View>
                <View style={styles.tourneyMid}>
                  <Text style={[styles.tourneyTitle, runitTextGlowCyan]} numberOfLines={2}>
                    {nextTournament?.name ?? 'Daily Tournament'}
                  </Text>
                  <Text style={styles.tourneyMeta}>
                    {nextTournament
                      ? `${nextTournament.current_player_count}/${nextTournament.max_players} players · ${formatTournamentState(nextTournament.state)}`
                      : '18/20 players · open'}
                  </Text>
                </View>
                <LinearGradient colors={[runit.neonPink, runit.neonPurple]} style={styles.joinBtn}>
                  <Text style={styles.joinBtnText}>JOIN</Text>
                </LinearGradient>
              </View>
            </LinearGradient>
          </Pressable>

          <View style={[styles.sectionLabel, { marginTop: 8 }]}>
            <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>YOUR STATS</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.statsRow}>
            {[['2', 'WINS', runit.neonCyan], ['1', 'LOSSES', runit.neonPink], ['3', 'STREAK', runit.neonPurple]].map(([val, lbl, col]) => (
              <LinearGradient key={lbl} colors={[col, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statGrad}>
                <View style={styles.statInner}>
                  <Text style={[styles.statVal, { color: col as string }]}>{val}</Text>
                  <Text style={styles.statLbl}>{lbl}</Text>
                </View>
              </LinearGradient>
            ))}
          </View>
          <Text style={styles.statsFoot}>Hey {displayName} — climb the board this season.</Text>

          <View style={styles.seasonCard}>
            {seasonQ.isLoading ? (
              <Text style={styles.muted}>Loading season…</Text>
            ) : seasonQ.data ? (
              <>
                <Text style={styles.seasonName}>{seasonQ.data.name}</Text>
                <Text style={styles.muted}>Ends {new Date(seasonQ.data.ends_at).toLocaleDateString()}</Text>
              </>
            ) : (
              <Text style={styles.muted}>Season info loading…</Text>
            )}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>

        <HeadToHeadPlayModal
          visible={!!h2hGate}
          gameTitle={h2hGate?.title ?? ''}
          entryUsd={h2hGate?.entryUsd ?? 0}
          prizeUsd={h2hGate?.prizeUsd ?? 0}
          onClose={() => setH2hGate(null)}
          onPractice={() => {
            if (!h2hGate) return;
            router.push(`${h2hGate.path}?mode=practice` as never);
            setH2hGate(null);
          }}
          onHeadToHeadPrize={() => {
            if (!h2hGate) return;
            const e = encodeURIComponent(String(h2hGate.entryUsd));
            const p = encodeURIComponent(String(h2hGate.prizeUsd));
            router.push(`/(app)/(tabs)/play/casual?entry=${e}&prize=${p}` as never);
            setH2hGate(null);
          }}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 14, paddingBottom: 100, paddingTop: 6 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionTitle: { color: 'rgba(226,232,240,0.95)', fontSize: 13, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', textShadowColor: runit.neonCyan, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(157,78,237,0.45)' },
  sectionSub: { color: 'rgba(148,163,184,0.9)', fontSize: 12, fontWeight: '600', marginBottom: 12, lineHeight: 17 },
  gameWrap: { marginBottom: 10 },
  gameBorder: { borderRadius: 16, padding: 2, shadowColor: 'rgba(255,0,110,0.4)', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 12, elevation: 8 },
  gameCard: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, minHeight: 80 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameIconCol: { width: 52, alignItems: 'center', justifyContent: 'center' },
  gameTextCol: { flex: 1 },
  gameTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 3, letterSpacing: 0.5 },
  gameEntry: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  prizeBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', minWidth: 90, alignItems: 'center' },
  prizeBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  tourneyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: 'rgba(8,4,18,0.88)' },
  trophyIcon: { justifyContent: 'center' },
  tourneyMid: { flex: 1 },
  tourneyTitle: { color: runit.neonCyan, fontSize: 16, fontWeight: '900', marginBottom: 4 },
  tourneyMeta: { color: 'rgba(203,213,225,0.85)', fontSize: 12, fontWeight: '600' },
  joinBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  joinBtnText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statGrad: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statInner: { backgroundColor: 'rgba(6,2,14,0.8)', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '900' },
  statLbl: { color: 'rgba(148,163,184,0.8)', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  statsFoot: { color: 'rgba(148,163,184,0.85)', fontSize: 12, marginBottom: 12, textAlign: 'center' },
  seasonCard: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(157,78,237,0.3)', backgroundColor: 'rgba(8,4,18,0.7)' },
  seasonName: { color: '#fff', fontWeight: '800', fontSize: 15 },
  muted: { color: 'rgba(148,163,184,0.85)', fontSize: 13 },
});
