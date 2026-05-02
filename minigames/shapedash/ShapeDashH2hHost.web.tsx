import { createElement } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { GameOverExitRow } from '@/minigames/ui/GameOverExitRow';
import { useMinigameExitNav } from '@/minigames/ui/useMinigameExitNav';
import type { H2hSkillContestBundle } from '@/types/match';

import { useShapeDashH2hHost } from './useShapeDashH2hHost';

/**
 * Head-to-head Shape Dash on web: iframe only — never import `react-native-webview` in this bundle.
 */
export function ShapeDashH2hHost({ h2hSkillContest }: { h2hSkillContest: H2hSkillContestBundle }) {
  const { replaceToPrimaryExit, replacePrimaryLabel, replaceToHomeTab } = useMinigameExitNav();
  const v = useShapeDashH2hHost(h2hSkillContest);

  return (
    <View style={[styles.flex, { minHeight: v.minEmbedHeight }]}>
      {!v.showResultsOverlay ? (
        <View style={[styles.flex, { position: 'relative', minHeight: v.minEmbedHeight }]}>
          {createElement('iframe', {
            title: 'Shape Dash H2H',
            srcDoc: v.html,
            allow: 'fullscreen',
            onLoad: (ev: unknown) => {
              const iframe = (ev as { target?: HTMLIFrameElement })?.target;
              if (iframe) v.iframeRef.current = iframe;
              v.focusIframeGame();
              v.requestWebFullscreenLandscape();
              setTimeout(v.focusIframeGame, 60);
              setTimeout(v.focusIframeGame, 220);
              setTimeout(v.requestWebFullscreenLandscape, 80);
            },
            style: ({
              border: 'none',
              width: '100%',
              height: '100%',
              minHeight: v.minEmbedHeight,
              display: 'block',
              backgroundColor: '#060610',
              flexGrow: 1,
            }) as Record<string, unknown>,
            tabIndex: 0,
            ref: (el: HTMLIFrameElement | null) => {
              v.iframeRef.current = el;
            },
          })}
        </View>
      ) : (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.card}>
            <GameOverExitRow
              minigamesLabel={replacePrimaryLabel}
              onMinigames={replaceToPrimaryExit}
              onHome={replaceToHomeTab}
            />
            <Text style={styles.goTitle}>Run ended</Text>
            <Text style={styles.goScore}>Your distance: {v.submittedScore}</Text>
            {v.h2hSubmitPhase === 'loading' ? <Text style={styles.practiceNote}>Submitting your run…</Text> : null}
            {v.h2hSubmitPhase === 'error' ? (
              <>
                <Text style={styles.practiceNote}>Could not submit this run. Check your connection.</Text>
                <AppButton title="Retry submit" variant="secondary" className="mt-2" onPress={() => v.setH2hRetryKey((k) => k + 1)} />
              </>
            ) : null}
            {v.h2hSubmitPhase === 'ok' && !v.h2hPoll?.both_submitted ? (
              <Text style={styles.practiceNote}>Waiting for {v.opponentDisplayName} to finish…</Text>
            ) : null}
            {v.h2hSubmitPhase === 'ok' && v.h2hPoll?.both_submitted ? (
              <Text style={styles.practiceNote}>Both runs in — finalizing match…</Text>
            ) : null}
          </View>
        </View>
      )}
      {v.webPortrait && !v.showResultsOverlay ? (
        <View style={styles.rotateHint} pointerEvents="none">
          <Text style={styles.rotateHintText}>Rotate to landscape for live Shape Dash</Text>
        </View>
      ) : null}
      {Platform.OS === 'web' && !v.showResultsOverlay ? (
        <View style={styles.fullscreenTapZone} pointerEvents="box-none">
          <AppButton title="Fullscreen" variant="ghost" onPress={v.requestWebFullscreenLandscape} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#060610', minHeight: 0 },
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
    maxWidth: 460,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    backgroundColor: 'rgba(10, 15, 28, 0.98)',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  goTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  goScore: { color: 'rgba(148,163,184,0.95)', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  practiceNote: { marginTop: 8, color: 'rgba(148,163,184,0.95)', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  rotateHint: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 10,
    alignItems: 'center',
    zIndex: 60,
  },
  rotateHintText: {
    color: '#fde68a',
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: 'rgba(2,6,23,0.78)',
    borderColor: 'rgba(251,191,36,0.45)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fullscreenTapZone: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 70,
  },
});
