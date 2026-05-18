import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeIonicons } from '@/components/icons/SafeIonicons';

import { AsyncHostPendingRunsPanel } from '@/components/arcade/AsyncHostPendingRunsPanel';
import { OpenAsyncChallengesFeed } from '@/components/tournaments/OpenAsyncChallengesFeed';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { pushCrossTab } from '@/lib/appNavigation';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { oneVsOneChallengesHref } from '@/lib/tabRoutes';
import { useAuthStore } from '@/store/authStore';

/**
 * Events hub for async 1v1 skill contests — open board of locked scores to challenge, plus your posted runs.
 */
export default function OneVsOneChallengesScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);

  function goPostAsyncRun() {
    const rt = encodeURIComponent(String(oneVsOneChallengesHref()));
    pushCrossTab(router, `/(app)/(tabs)/play/async-run?returnTo=${rt}` as never);
  }

  return (
    <Screen scroll>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>1V1 BATTLES</Text>
      <Text style={styles.sectionLabel}>CONTESTS WAITING TO SETTLE</Text>
      <Text style={styles.sub}>
        {`Open rows from other players — each one already locked a score and entry tier. Pick a match, pay the same stake, play your run, and validated scores decide the winner.`}
      </Text>

      <OpenAsyncChallengesFeed userId={uid} hideBoardHeader />

      {ENABLE_BACKEND && uid ? (
        <>
          <View style={styles.divider} />
          <Pressable
            onPress={goPostAsyncRun}
            accessibilityRole="button"
            accessibilityLabel="Post your async run"
            style={({ pressed }) => [styles.postCtaOuter, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient
              colors={[runit.neonPurple, '#6d28d9']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.postCtaGrad}
            >
              <SafeIonicons name="flash" size={20} color="#fff" />
              <Text style={[styles.postCtaTxt, { fontFamily: runitFont.black }]}>Post your score — async run</Text>
              <SafeIonicons name="chevron-forward" size={20} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
          </Pressable>
          <AsyncHostPendingRunsPanel userId={uid} variant="embedded" />
        </>
      ) : (
        <Text style={styles.guestNote}>Sign in to post a run or see your contest history.</Text>
      )}

      <Text style={styles.footerNote}>Prizes follow official rules and eligibility.</Text>
      <View style={{ height: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, letterSpacing: 1, marginBottom: 4, color: '#fff' },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 2,
    color: 'rgba(253,186,219,0.85)',
    fontWeight: '800',
    marginBottom: 12,
  },
  sub: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.25)',
    marginVertical: 20,
  },
  postCtaOuter: { borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  postCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  postCtaTxt: { flex: 1, color: '#fff', fontSize: 15, letterSpacing: 0.3 },
  guestNote: { color: 'rgba(148,163,184,0.95)', fontSize: 13, lineHeight: 19, marginTop: 8 },
  footerNote: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 16, lineHeight: 17 },
});
