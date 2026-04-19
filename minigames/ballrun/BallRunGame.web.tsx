import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import type { DailyTournamentBundle } from '@/types/dailyTournamentPlay';
import type { H2hSkillContestBundle } from '@/types/match';

/**
 * Ball Run uses @react-three/fiber/native + expo-gl (native GL). Web export skips the 3D stack.
 */
export default function NeonBallRunGame({
  h2hSkillContest,
}: {
  playMode?: 'practice' | 'prize';
  runSeed?: number;
  dailyTournament?: DailyTournamentBundle;
  h2hSkillContest?: H2hSkillContestBundle;
}) {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.box}>
        <Text style={styles.title}>Ball Run</Text>
        <Text style={styles.body}>
          This game uses native 3D (expo-gl) and is only available in the mobile app. Open Run iT Arcade on iOS or
          Android to play.
        </Text>
        <Pressable
          onPress={() => {
            if (h2hSkillContest) {
              h2hSkillContest.onComplete({
                winnerId: h2hSkillContest.opponentId,
                finalScore: { self: 0, opponent: 0 },
                reason: 'forfeit',
              });
            } else {
              router.back();
            }
          }}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnTxt}>{h2hSkillContest ? 'Exit match' : 'Go back'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff' },
  body: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.85)' },
  btn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#ff006e',
  },
  btnTxt: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
