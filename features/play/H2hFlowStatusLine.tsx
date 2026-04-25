import { StyleSheet, Text, View } from 'react-native';

import type { QueueKind } from '@/store/matchmakingStore';

type Phase = 'idle' | 'searching' | 'found' | 'lobby' | 'in_match';

const STEP = {
  queue: 'In queue',
  matched: 'Matched',
  lobbyWait: 'Waiting in lobby',
  bothReady: 'Ready to play',
} as const;

/**
 * One-line H2H progress so users know what happens next (queue screen + optional lobby variant).
 */
export function H2hQueueStatusLine({
  phase,
  mode,
}: {
  phase: Phase;
  mode: QueueKind;
}) {
  if (phase === 'idle') return null;

  let line = '';
  if (phase === 'searching') {
    line = `${STEP.queue} — searching for an opponent (${mode === 'ranked' ? 'ranked' : 'casual'})…`;
  } else if (phase === 'found') {
    line = `${STEP.matched} — accept in the modal to open the lobby`;
  } else {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Text style={styles.dot}>●</Text>
      <Text style={styles.txt}>{line}</Text>
    </View>
  );
}

export function H2hLobbyStatusLine({
  loading,
  bothPlayersJoined,
  status,
}: {
  loading: boolean;
  bothPlayersJoined: boolean;
  status: string | null | undefined;
}) {
  let line = '';
  if (loading) {
    line = 'Loading match…';
  } else if (status === 'lobby' && bothPlayersJoined) {
    line = `${STEP.bothReady} — tap Start match when you are set`;
  } else if (status === 'lobby') {
    line = `${STEP.lobbyWait} — opponent may still be connecting`;
  } else {
    line = 'Preparing match…';
  }

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Text style={styles.dot}>●</Text>
      <Text style={styles.txt}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  dot: { color: '#FFD700', fontSize: 10, marginTop: 3 },
  txt: {
    flex: 1,
    color: 'rgba(226, 232, 240, 0.95)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
