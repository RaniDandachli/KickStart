import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import type { AsyncH2hQueueSubmitPhase } from '@/hooks/useAsyncH2hQueueHostSubmission';
import { GameOverExitRow } from '@/minigames/ui/GameOverExitRow';

type Props = {
  /** `overlay` = full-screen dim layer; `card` = inner card only (e.g. inside RN Modal). */
  layout?: 'overlay' | 'card';
  asyncHostSubmitPhase: AsyncH2hQueueSubmitPhase;
  /** e.g. "Score: 120" or "You 3 – 2 CPU" */
  scoreLine: string;
  onPlayAgain: () => void;
  playAgainDisabled?: boolean;
  minigamesLabel: string;
  onMinigames: () => void;
  onHome: () => void;
  maxWidth?: number;
};

/**
 * After a solo run for an async staked host queue, show wallet lock / retry while `useAsyncH2hQueueHostSubmission` runs.
 */
export function AsyncH2hQueueHostLockOverlay({
  layout = 'overlay',
  asyncHostSubmitPhase,
  scoreLine,
  onPlayAgain,
  playAgainDisabled,
  minigamesLabel,
  onMinigames,
  onHome,
  maxWidth = 360,
}: Props) {
  const inner = (
    <View style={[styles.card, { maxWidth }]}>
      <GameOverExitRow minigamesLabel={minigamesLabel} onMinigames={onMinigames} onHome={onHome} />
      <Text style={styles.title}>Run ended</Text>
      <Text style={styles.score}>{scoreLine}</Text>
      {asyncHostSubmitPhase === 'loading' ? (
        <Text style={styles.note}>Locking your contest entry on the server…</Text>
      ) : null}
      {asyncHostSubmitPhase === 'ok' ? (
        <Text style={styles.note}>
          You&apos;re on the stack for this tier. Opponents who pick the same stake row still play live; your run is
          compared when they finish.
        </Text>
      ) : null}
      {asyncHostSubmitPhase === 'error' ? (
        <Text style={styles.note}>
          We could not charge your wallet or store this run. Check the alert, then tap Play again to retry.
        </Text>
      ) : null}
      <AppButton title="Play again" onPress={onPlayAgain} className="mb-3" disabled={playAgainDisabled} />
    </View>
  );

  if (layout === 'card') {
    return inner;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 50,
  },
  card: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    backgroundColor: 'rgba(10, 15, 28, 0.98)',
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  score: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  note: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
});
