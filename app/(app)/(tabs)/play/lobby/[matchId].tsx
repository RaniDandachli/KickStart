import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useMatchSessionWithPlayers } from '@/hooks/useMatchSessionWithPlayers';
import { useProfile } from '@/hooks/useProfile';
import { isUuid } from '@/lib/isUuid';
import { queryKeys } from '@/lib/queryKeys';
import { runit, runitFont, runitGlowPinkSoft, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { displayNameForProfile, h2hAbandonMatchSessionRpc } from '@/services/api/h2hMatchSession';
import { useAuthStore } from '@/store/authStore';
import { useMatchmakingStore } from '@/store/matchmakingStore';

export default function PreMatchLobbyScreen() {
  const params = useLocalSearchParams<{ matchId: string | string[] }>();
  const rawMid = params.matchId;
  const matchId = Array.isArray(rawMid) ? rawMid[0] : rawMid;
  const router = useRouter();
  const qc = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const selfId = useAuthStore((s) => s.user?.id ?? 'guest');
  const activeMatch = useMatchmakingStore((s) => s.activeMatch);

  const sameSession = activeMatch?.matchId === matchId;
  const opp = sameSession ? activeMatch.opponent : null;
  const msQ = useMatchSessionWithPlayers(matchId);
  const selfProfile = useProfile(selfId === 'guest' ? undefined : selfId);

  const isParticipant =
    ENABLE_BACKEND &&
    selfId !== 'guest' &&
    !!msQ.data &&
    (msQ.data.player_a_id === selfId || msQ.data.player_b_id === selfId);

  const hasOpponent =
    (!!sameSession && !!opp) ||
    (!!isParticipant && !!msQ.data?.player_a_id && !!msQ.data?.player_b_id);

  const prizeBlock = useMemo(() => {
    if (sameSession && activeMatch) {
      if (activeMatch.casualFree) return { kind: 'free_casual' as const };
      if (activeMatch.listedPrizeUsd != null && activeMatch.listedPrizeUsd > 0) {
        return {
          kind: 'paid' as const,
          prize: activeMatch.listedPrizeUsd,
          entry: activeMatch.entryFeeUsd ?? '—',
        };
      }
      return { kind: 'free_casual' as const };
    }
    if (isParticipant && msQ.data) {
      const ec = msQ.data.entry_fee_wallet_cents ?? 0;
      const pc = msQ.data.listed_prize_usd_cents ?? 0;
      if (ec <= 0 && pc <= 0) return { kind: 'free_casual' as const };
      if (pc > 0) {
        return {
          kind: 'paid' as const,
          prize: pc / 100,
          entry: ec > 0 ? ec / 100 : '—',
        };
      }
      return { kind: 'free_casual' as const };
    }
    return { kind: 'unknown' as const };
  }, [sameSession, activeMatch, isParticipant, msQ.data]);

  const selfDisplayName = useMemo(() => {
    if (selfId === 'guest') return 'You';
    if (selfProfile.data) {
      return displayNameForProfile(selfProfile.data.username, selfProfile.data.display_name);
    }
    return `Player ${selfId.slice(0, 6)}…`;
  }, [selfId, selfProfile.data]);

  const opponentDisplayName = useMemo(() => {
    if (ENABLE_BACKEND && msQ.data && selfId !== 'guest') {
      const ms = msQ.data;
      if (ms.player_a_id === selfId) {
        return displayNameForProfile(ms.player_b_username, ms.player_b_display);
      }
      if (ms.player_b_id === selfId) {
        return displayNameForProfile(ms.player_a_username, ms.player_a_display);
      }
    }
    return opp?.username ?? '—';
  }, [msQ.data, selfId, opp?.username]);

  async function onLeaveLobby() {
    if (leaving) return;

    if (ENABLE_BACKEND && selfId !== 'guest' && matchId && isUuid(matchId)) {
      setLeaving(true);
      try {
        const r = await h2hAbandonMatchSessionRpc(matchId);
        if (!r.ok) {
          if (r.error === 'cannot_abandon_after_start') {
            Alert.alert(
              'Match in progress',
              'Finish on the match screen, then record the result. You can’t cancel from the lobby once play has started.',
            );
            return;
          }
          Alert.alert('Could not leave', r.error);
          return;
        }
        void qc.invalidateQueries({ queryKey: queryKeys.matchSession(matchId) });
        void qc.invalidateQueries({ queryKey: queryKeys.profile(selfId) });
        void qc.invalidateQueries({ queryKey: queryKeys.transactions(selfId) });
      } catch (e) {
        Alert.alert('Could not leave', e instanceof Error ? e.message : 'Error');
        return;
      } finally {
        setLeaving(false);
      }
    }

    useMatchmakingStore.getState().setActiveMatch(null);
    router.replace('/(app)/(tabs)/play');
  }

  if (
    ENABLE_BACKEND &&
    selfId !== 'guest' &&
    matchId &&
    isUuid(matchId) &&
    !msQ.isLoading &&
    msQ.data &&
    isParticipant &&
    msQ.data.status === 'in_progress'
  ) {
    return (
      <Screen scroll={false}>
        <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>Match in progress</Text>
        <Text style={styles.sub}>
          You already opened the skill contest — resume play, or use Arcade to leave the flow.
        </Text>
        <AppButton title="Resume match" onPress={() => router.push(`/(app)/(tabs)/play/match/${matchId}`)} />
        <AppButton
          className="mt-2"
          title="Arcade"
          variant="ghost"
          onPress={() => {
            useMatchmakingStore.getState().setActiveMatch(null);
            router.replace('/(app)/(tabs)/play');
          }}
        />
      </Screen>
    );
  }

  if (
    ENABLE_BACKEND &&
    selfId !== 'guest' &&
    matchId &&
    isUuid(matchId) &&
    !msQ.isLoading &&
    msQ.data &&
    isParticipant &&
    (msQ.data.status === 'cancelled' || msQ.data.status === 'completed')
  ) {
    return (
      <Screen scroll={false}>
        <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>Lobby closed</Text>
        <Text style={styles.sub}>
          {msQ.data.status === 'cancelled'
            ? 'This match was cancelled. Contest access was refunded to your wallet when it applied.'
            : 'This contest already finished — you can’t use this lobby anymore.'}
        </Text>
        <AppButton
          title="Back to Arcade"
          onPress={() => {
            useMatchmakingStore.getState().setActiveMatch(null);
            router.replace('/(app)/(tabs)/play');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>1v1 LOBBY</Text>
      <Text style={styles.sub}>Player vs player — you vs your opponent. Review names, then start.</Text>

      <LinearGradient colors={[runit.neonPink, runit.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.vsBorder, runitGlowPinkSoft]}>
        <View style={styles.vsInner}>
          <View style={styles.row}>
            <PlayerCard
              label="You"
              name={selfDisplayName}
              sub="Ready"
              accent="cyan"
            />
            <Text style={styles.vs}>VS</Text>
            <PlayerCard
              label="Opponent"
              name={opponentDisplayName}
              sub={
                opp
                  ? `${opp.rating} · ${opp.region}`
                  : hasOpponent
                    ? 'Ready'
                    : 'Open queue from matchmaking'
              }
              accent="pink"
            />
          </View>

          {prizeBlock.kind === 'paid' ? (
            <View style={styles.prizeRow}>
              <SafeIonicons name="trophy-outline" size={18} color={runit.neonCyan} />
              <Text style={styles.prizeText}>
                Prize ${prizeBlock.prize} · Contest access ${prizeBlock.entry} each (Run It)
              </Text>
            </View>
          ) : prizeBlock.kind === 'free_casual' ? (
            <Text style={styles.freeText}>Casual match · no entry fee · no cash prize</Text>
          ) : (
            <Text style={styles.freeText}>Free casual match</Text>
          )}

          <Text style={styles.mono} numberOfLines={1}>
            Match {matchId}
          </Text>
        </View>
      </LinearGradient>

      <Text style={styles.hint}>Prototype: tap start to open the skill match screen. Real builds add ready-check + sync.</Text>

      <AppButton
        title={hasOpponent ? 'Start match' : 'Back to queue'}
        onPress={() => {
          if (hasOpponent) {
            router.push(`/(app)/(tabs)/play/match/${matchId}`);
          } else {
            router.replace('/(app)/(tabs)/play/casual');
          }
        }}
      />
      <AppButton
        title={leaving ? 'Leaving…' : 'Leave'}
        variant="ghost"
        disabled={leaving}
        onPress={() => void onLeaveLobby()}
      />
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
