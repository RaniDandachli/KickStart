import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { ENABLE_DAILY_FREE_TOURNAMENT } from '@/constants/featureFlags';
import { formatEntryType, formatFormat, formatTournamentState } from '@/features/tournaments/tournamentPresentation';
import { useTournaments } from '@/hooks/useTournaments';
import { DAILY_FREE_PRIZE_USD } from '@/lib/dailyFreeTournament';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';

export default function TournamentsListScreen() {
  const router = useRouter();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { data, isLoading, isError } = useTournaments(false);

  return (
    <Screen>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>EVENTS</Text>
      <Text style={styles.sub}>Skill-based tournaments — admin-awarded prizes</Text>

      {ENABLE_DAILY_FREE_TOURNAMENT ? (
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/tournaments/daily-free')}
          style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[runit.neonCyan, '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardBorder}
          >
            <View style={styles.cardInner}>
              <View style={styles.cardTop}>
                <Text style={[styles.cardName, { fontFamily: runitFont.bold }]} numberOfLines={2}>
                  Tournament of the Day
                </Text>
                <View style={[styles.statePill, { borderColor: '#39ff14' }]}>
                  <Text style={[styles.statePillText, { color: '#39ff14' }]}>FREE</Text>
                </View>
              </View>
              <Text style={styles.cardMetaTxt}>
                ${DAILY_FREE_PRIZE_USD} showcase prize · 8 rounds · no entry fee
              </Text>
              <Text style={[styles.cardPrize, { marginTop: 6 }]}>
                Promotional daily bracket — tap to enter
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.viewLink}>Enter</Text>
                <Ionicons name="chevron-forward" size={14} color={runit.neonPink} />
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}

      {isLoading && (
        <>
          <SkeletonBlock className="mb-3 h-24" />
          <SkeletonBlock className="mb-3 h-24" />
        </>
      )}
      {isError && <EmptyState title="Could not load events" description="Check .env and RLS policies." />}

      {data?.map((t) => {
        const isHi = !!(highlight && t.id === highlight);
        return (
          <Pressable key={t.id} onPress={() => router.push(`/(app)/(tabs)/tournaments/${t.id}`)} style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.92 }]}>
            <LinearGradient
              colors={isHi ? [runit.neonCyan, runit.neonPurple] : [runit.neonPurple, 'rgba(157,78,237,0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardBorder}
            >
              <View style={styles.cardInner}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardName, { fontFamily: runitFont.bold }]} numberOfLines={2}>{t.name}</Text>
                  <View style={[styles.statePill, { borderColor: stateColor(t.state) }]}>
                    <Text style={[styles.statePillText, { color: stateColor(t.state) }]}>{formatTournamentState(t.state).toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardMetaTxt}>{formatFormat(t.format)} · {t.current_player_count}/{t.max_players} players</Text>
                  <Text style={[styles.cardMetaTxt, { color: runit.neonCyan }]}>{formatEntryType(t.entry_type)}</Text>
                </View>
                {t.starts_at ? <Text style={styles.cardDate}>⏱  {new Date(t.starts_at).toLocaleString()}</Text> : null}
                <Text style={styles.cardPrize} numberOfLines={2}>{t.prize_description}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.viewLink}>View details</Text>
                  <Ionicons name="chevron-forward" size={14} color={runit.neonPink} />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}

      {!isLoading && !data?.length ? (
        <EmptyState title="No tournaments" description="Run seed SQL or call createTournament (admin)." />
      ) : null}
    </Screen>
  );
}

function stateColor(state: string) {
  if (state === 'open') return '#39ff14';
  if (state === 'active') return '#00f0ff';
  if (state === 'full') return '#ffbe0b';
  return 'rgba(148,163,184,0.8)';
}

const styles = StyleSheet.create({
  title: { color: runit.neonPink, fontSize: 30, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
  sub: { color: 'rgba(203,213,225,0.85)', fontSize: 13, marginBottom: 18 },
  cardWrap: { marginBottom: 14 },
  cardBorder: { borderRadius: 16, padding: 2 },
  cardInner: { backgroundColor: 'rgba(8,4,18,0.88)', borderRadius: 14, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardName: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '900' },
  statePill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statePillText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardMeta: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  cardMetaTxt: { color: 'rgba(148,163,184,0.85)', fontSize: 12, fontWeight: '700' },
  cardDate: { color: 'rgba(148,163,184,0.75)', fontSize: 11, marginBottom: 6 },
  cardPrize: { color: 'rgba(203,213,225,0.9)', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewLink: { color: runit.neonPink, fontSize: 13, fontWeight: '800' },
});
