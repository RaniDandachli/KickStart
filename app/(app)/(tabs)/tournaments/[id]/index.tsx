import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GuestAuthPromptModal } from '@/components/auth/GuestAuthPromptModal';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import {
  formatEntryType,
  formatFormat,
  formatTournamentState,
  formatTournamentWalletEntry,
} from '@/features/tournaments/tournamentPresentation';
import { useJoinTournament, useTournament, useTournamentRules } from '@/hooks/useTournaments';
import { useAuthStore } from '@/store/authStore';
import {
  appBorderAccentMuted,
  appChromeGradientFadePink,
  runit,
  runitFont,
  runitTextGlowPink,
} from '@/lib/runitArcadeTheme';

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const authStatus = useAuthStore((s) => s.status);
  const [guestAuthOpen, setGuestAuthOpen] = useState(false);
  const tq = useTournament(id);
  const rq = useTournamentRules(id);
  const join = useJoinTournament(userId);
  const t = tq.data;

  function onJoin() {
    if (!t) {
      Alert.alert('RunitArcade', 'Tournament is still loading. Try again in a moment.');
      return;
    }
    if (!userId) {
      setGuestAuthOpen(true);
      return;
    }
    const isFull = !t.unlimited_entrants && t.current_player_count >= t.max_players;
    if (t.state !== 'open' || isFull) {
      Alert.alert('RunitArcade', 'This tournament is full or not open for registration.');
      return;
    }
    join.mutate(t.id, {
      onSuccess: () => Alert.alert('You are in!', 'Entry recorded — brackets lock via admin workflow.'),
      onError: (e) => Alert.alert('Join failed', e.message),
    });
  }

  return (
    <Screen>
      {tq.isLoading && <SkeletonBlock className="mb-4 h-32" />}
      {!tq.isLoading && !t && <EmptyState title="Not found" />}
      {t ? (
        <>
          <View style={styles.chips}>
            <View style={[styles.chip, { borderColor: runit.neonCyan }]}><Text style={[styles.chipText, { color: runit.neonCyan }]}>{formatTournamentState(t.state).toUpperCase()}</Text></View>
            <View style={[styles.chip, { borderColor: runit.neonPurple }]}><Text style={[styles.chipText, { color: runit.neonPurple }]}>{formatEntryType(t.entry_type).toUpperCase()}</Text></View>
            <View style={[styles.chip, { borderColor: 'rgba(148,163,184,0.5)' }]}><Text style={[styles.chipText, { color: 'rgba(148,163,184,0.9)' }]}>{formatFormat(t.format).toUpperCase()}</Text></View>
          </View>

          <Text style={[styles.name, { fontFamily: runitFont.black }, runitTextGlowPink]}>{t.name}</Text>
          <Text style={styles.desc}>{t.description}</Text>

          <LinearGradient colors={[runit.neonPink, appChromeGradientFadePink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.detailBorder}>
            <View style={styles.detailInner}>
              <InfoRow label="PRIZE" value={t.prize_description} />
              <InfoRow label="SLOTS" value={`${t.current_player_count} / ${t.max_players}`} />
              <InfoRow label="ENTRY" value={formatTournamentWalletEntry(t.entry_type, t.entry_fee_wallet_cents)} />
              {t.starts_at ? <InfoRow label="START" value={new Date(t.starts_at).toLocaleString()} /> : null}
              {t.rules_summary ? <InfoRow label="SUMMARY" value={t.rules_summary} /> : null}
            </View>
          </LinearGradient>

          <Text style={[styles.rulesTitle, { fontFamily: runitFont.black }]}>RULES</Text>
          {rq.data?.length ? (
            rq.data.map((r) => (
              <View key={r.id} style={styles.ruleCard}>
                <Text style={styles.ruleTitle}>{r.title}</Text>
                <Text style={styles.ruleBody}>{r.body}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noRules}>No detailed rules rows.</Text>
          )}

          <View style={styles.actions}>
            <AppButton
              title={!userId ? 'Sign in to join' : 'Join tournament'}
              loading={authStatus === 'loading' || join.isPending}
              disabled={authStatus === 'loading'}
              onPress={() => {
                if (authStatus === 'loading') return;
                if (!userId) {
                  setGuestAuthOpen(true);
                  return;
                }
                onJoin();
              }}
            />
            <AppButton className="mt-2" title="View bracket" variant="secondary" onPress={() => router.push(`/(app)/(tabs)/tournaments/${t.id}/bracket`)} />
          </View>
        </>
      ) : null}

      <GuestAuthPromptModal
        visible={guestAuthOpen}
        variant="tournaments"
        onClose={() => setGuestAuthOpen(false)}
      />
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLbl}>{label}</Text>
      <Text style={styles.infoVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  name: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  desc: { color: 'rgba(203,213,225,0.9)', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  detailBorder: { borderRadius: 16, padding: 2, marginBottom: 20 },
  detailInner: { backgroundColor: 'rgba(8,4,18,0.88)', borderRadius: 14, padding: 14 },
  infoRow: { marginBottom: 10 },
  infoLbl: { color: 'rgba(255, 0, 110, 0.92)', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
  infoVal: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  rulesTitle: { color: runit.neonCyan, fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  ruleCard: { borderRadius: 12, borderWidth: 1, borderColor: appBorderAccentMuted, backgroundColor: 'rgba(12,6,22,0.85)', padding: 12, marginBottom: 8 },
  ruleTitle: { color: '#fff', fontWeight: '800', fontSize: 14, marginBottom: 4 },
  ruleBody: { color: 'rgba(203,213,225,0.85)', fontSize: 13, lineHeight: 18 },
  noRules: { color: 'rgba(148,163,184,0.7)', fontSize: 13, marginBottom: 16 },
  actions: { marginTop: 16, gap: 8 },
});
