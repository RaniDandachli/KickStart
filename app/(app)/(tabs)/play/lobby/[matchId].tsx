import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';
import { useMatchmakingStore } from '@/store/matchmakingStore';

export default function PreMatchLobbyScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const selfId = useAuthStore((s) => s.user?.id ?? 'guest');
  const activeMatch = useMatchmakingStore((s) => s.activeMatch);

  const sameSession = activeMatch?.matchId === matchId;
  const opp = sameSession ? activeMatch.opponent : null;

  return (
    <Screen scroll={false}>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>1v1 LOBBY</Text>
      <Text style={styles.sub}>Session ready — review who you&apos;re facing, then start.</Text>

      <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.vsBorder, runitGlowPinkSoft]}>
        <View style={styles.vsInner}>
          <View style={styles.row}>
            <PlayerCard
              label="You"
              name={selfId === 'guest' ? 'You' : `Player ${selfId.slice(0, 6)}…`}
              sub="Ready"
              accent="cyan"
            />
            <Text style={styles.vs}>VS</Text>
            <PlayerCard
              label="Opponent"
              name={opp?.username ?? '—'}
              sub={opp ? `${opp.rating} · ${opp.region}` : 'Open queue from matchmaking'}
              accent="pink"
            />
          </View>

          {sameSession && activeMatch?.listedPrizeUsd != null ? (
            <View style={styles.prizeRow}>
              <Ionicons name="trophy-outline" size={18} color={runit.neonCyan} />
              <Text style={styles.prizeText}>
                Fixed reward ${activeMatch.listedPrizeUsd} · Contest fee ${activeMatch.entryFeeUsd ?? '—'} each (demo)
              </Text>
            </View>
          ) : (
            <Text style={styles.freeText}>Free match · demo matchmaking</Text>
          )}

          <Text style={styles.mono} numberOfLines={1}>
            Match {matchId}
          </Text>
        </View>
      </LinearGradient>

      <Text style={styles.hint}>Prototype: tap start to open the skill match screen. Real builds add ready-check + sync.</Text>

      <AppButton
        title={opp ? 'Start match' : 'Back to queue'}
        onPress={() => {
          if (opp) {
            router.push(`/(app)/(tabs)/play/match/${matchId}`);
          } else {
            router.replace('/(app)/(tabs)/play/casual');
          }
        }}
      />
      <AppButton title="Leave" variant="ghost" onPress={() => router.replace('/(app)/(tabs)/play')} />
    </Screen>
  );
}

function PlayerCard({
  label,
  name,
  sub,
  accent,
}: {
  label: string;
  name: string;
  sub: string;
  accent: 'cyan' | 'pink';
}) {
  const glow = accent === 'cyan' ? runitTextGlowCyan : runitTextGlowPink;
  return (
    <View style={styles.pCard}>
      <Text style={styles.pLbl}>{label}</Text>
      <Text style={[styles.pName, glow]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.pSub} numberOfLines={2}>
        {sub}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#fff',
    fontSize: 22,
    letterSpacing: 2,
    marginBottom: 6,
  },
  sub: { color: 'rgba(148,163,184,0.95)', fontSize: 13, marginBottom: 16, lineHeight: 18 },
  vsBorder: { borderRadius: 16, padding: 2, marginBottom: 16 },
  vsInner: {
    backgroundColor: 'rgba(6,2,14,0.94)',
    borderRadius: 14,
    padding: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vs: {
    fontFamily: runitFont.black,
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(255,0,110,0.6)',
    textShadowRadius: 10,
  },
  pCard: { flex: 1, minHeight: 100, padding: 10, borderRadius: 12, backgroundColor: 'rgba(12,6,22,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  pLbl: { fontSize: 10, fontWeight: '800', color: 'rgba(148,163,184,0.9)', letterSpacing: 1, marginBottom: 4 },
  pName: { fontSize: 16, fontWeight: '900', color: '#f8fafc', marginBottom: 4 },
  pSub: { fontSize: 11, color: 'rgba(148,163,184,0.95)', lineHeight: 15 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  prizeText: { flex: 1, color: 'rgba(226,232,240,0.95)', fontSize: 12, fontWeight: '700' },
  freeText: { marginTop: 14, color: 'rgba(148,163,184,0.9)', fontSize: 12, textAlign: 'center' },
  mono: { marginTop: 10, fontSize: 10, color: 'rgba(100,116,139,0.95)', fontVariant: ['tabular-nums'] },
  hint: { color: 'rgba(148,163,184,0.85)', fontSize: 11, lineHeight: 16, marginBottom: 16, textAlign: 'center' },
});
