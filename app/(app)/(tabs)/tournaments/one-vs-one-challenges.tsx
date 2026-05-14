import { Text, StyleSheet, View } from 'react-native';

import { OpenAsyncChallengesFeed } from '@/components/tournaments/OpenAsyncChallengesFeed';
import { Screen } from '@/components/ui/Screen';
import { runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';

/**
 * Events hub for **async** 1v1 skill contests only — browse open locked scores and join the same tier to beat them.
 * (Showcase “hit N gates” solo lanes live under Play / minigames, not here.)
 */
export default function OneVsOneChallengesScreen() {
  const uid = useAuthStore((s) => s.user?.id);

  return (
    <Screen scroll>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>ASYNC RUNS</Text>
      <Text style={styles.sectionLabel}>OPEN SCORE CHALLENGES</Text>
      <Text style={styles.sub}>
        {`These are real async contest rows: someone already played solo and locked a score + entry tier. Match the same stake, play your run, and validated scores decide the winner — no live lobby.`}
      </Text>
      <Text style={styles.detail}>
        {`To post your own run for others to chase, use Play → Contests & queue (async). Prizes follow official rules and eligibility.`}
      </Text>

      <OpenAsyncChallengesFeed userId={uid} />

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
  sub: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 21, marginBottom: 10 },
  detail: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19, marginBottom: 18 },
});
