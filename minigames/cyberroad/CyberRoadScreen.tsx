import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { AppButton } from '@/components/ui/AppButton';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import AudioManager from './core/AudioManager';
import GameScreen from './core/app/GameScreen';
import GameProvider from './core/context/GameProvider';
import { useResolvedValue } from './core/hooks/useResolvedValue';
import ModelLoader from './core/ModelLoader';
import { CYBER_ROAD_STUDIO } from './core/branding';
import { CyberRoadUi } from './core/uiTheme';
import { Countdown } from '@/minigames/ui/Countdown';
import { runitFont } from '@/lib/runitArcadeTheme';
import { useMinigameExitNav } from '@/minigames/ui/useMinigameExitNav';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import type { H2hSkillContestBundle } from '@/types/match';

export default function CyberRoadScreen({
  h2hSkillContest,
}: {
  h2hSkillContest?: H2hSkillContestBundle;
} = {}) {
  useHidePlayTabBar();
  const { onHeaderBackPress, replacePrimaryLabel } = useMinigameExitNav();
  const [fontLoaded] = useFonts({
    retro: require('../../assets/minigames/cyberroad/fonts/retro.ttf'),
  });
  const [audioLoaded, audioError] = useResolvedValue(() => AudioManager.setupAsync());
  const [modelsLoaded, modelsError] = useResolvedValue(() => ModelLoader.loadModels());

  const [matchPhase, setMatchPhase] = useState<'countdown' | 'playing' | 'results' | null>(() =>
    h2hSkillContest ? 'countdown' : null,
  );
  const lastRunRef = useRef({ score: 0, durationMs: 0, taps: 0 });

  const buildH2hBody = useCallback(() => {
    const r = lastRunRef.current;
    return {
      game_type: 'cyber_road' as const,
      score: r.score,
      duration_ms: r.durationMs,
      taps: r.taps,
      match_session_id: h2hSkillContest!.matchSessionId,
    };
  }, [h2hSkillContest]);

  const h2hHookPhase =
    !h2hSkillContest || matchPhase === null
      ? 'playing'
      : matchPhase === 'results'
        ? 'results'
        : 'playing';

  const { h2hSubmitPhase, h2hPoll, setH2hRetryKey } = useH2hSkillContestSubmitAndPoll(
    h2hSkillContest,
    h2hHookPhase,
    buildH2hBody,
    'results',
  );

  const onH2hRunComplete = useCallback(
    (stats: { score: number; durationMs: number; taps: number }) => {
      if (!h2hSkillContest) return;
      lastRunRef.current = stats;
      setMatchPhase('results');
    },
    [h2hSkillContest],
  );

  const onCountdownDone = useCallback(() => {
    setMatchPhase('playing');
  }, []);

  const assetsReady = Boolean(fontLoaded && audioLoaded && modelsLoaded);
  const showGame =
    assetsReady && (!h2hSkillContest || matchPhase === 'playing' || matchPhase === 'results');
  const showCountdownOverlay = Boolean(h2hSkillContest && matchPhase === 'countdown');

  const headerHint = useMemo(
    () =>
      h2hSkillContest
        ? `vs ${h2hSkillContest.opponentDisplayName}`
        : replacePrimaryLabel,
    [h2hSkillContest, replacePrimaryLabel],
  );

  useFocusEffect(
    useCallback(() => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, []),
  );

  return (
    <View style={styles.wrap}>
      <SafeAreaView style={styles.safeTop} edges={['top']} accessibilityRole="header">
        <Pressable
          onPress={onHeaderBackPress}
          accessibilityRole="button"
          accessibilityLabel={`Back · ${headerHint}`}
          hitSlop={12}
          style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.88 }]}
        >
          <SafeIonicons name="chevron-back" size={24} color="#22d3ee" />
          <View style={{ flex: 1 }}>
            <Text style={styles.backTxt}>{replacePrimaryLabel}</Text>
            {h2hSkillContest ? (
              <Text style={styles.backSub} numberOfLines={1}>
                vs {h2hSkillContest.opponentDisplayName}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </SafeAreaView>
      <View style={styles.loadingOverlay}>
        {audioError || modelsError ? (
          <>
            <Text style={styles.loadingText}>Cyber Road failed to load</Text>
            <Text style={styles.loadingSub}>{audioError?.message ?? modelsError?.message ?? 'Unknown load error'}</Text>
          </>
        ) : assetsReady ? (
          <>
            {showGame ? (
              <GameProvider>
                <GameScreen
                  h2hSkillContest={Boolean(h2hSkillContest)}
                  h2hSuppressGameOver={Boolean(h2hSkillContest && matchPhase === 'results')}
                  onH2hRunComplete={h2hSkillContest ? onH2hRunComplete : undefined}
                />
              </GameProvider>
            ) : null}
            <Countdown active={showCountdownOverlay} onComplete={onCountdownDone} />
            {h2hSkillContest && matchPhase === 'results' ? (
              <View style={styles.h2hOverlay} pointerEvents="box-none">
                {h2hSubmitPhase === 'loading' ? (
                  <View style={styles.h2hCard}>
                    <ActivityIndicator size="large" color="#22d3ee" />
                    <Text style={styles.h2hTitle}>Submitting score…</Text>
                  </View>
                ) : h2hSubmitPhase === 'error' ? (
                  <View style={styles.h2hCard}>
                    <Text style={styles.h2hTitle}>Could not submit</Text>
                    <Text style={styles.h2hSub}>Check your connection and try again.</Text>
                    <AppButton className="mt-4" title="Retry" onPress={() => setH2hRetryKey((k) => k + 1)} />
                  </View>
                ) : h2hSubmitPhase === 'ok' && h2hPoll && !h2hPoll.both_submitted ? (
                  <View style={styles.h2hCard}>
                    <ActivityIndicator size="large" color="#a78bfa" />
                    <Text style={styles.h2hTitle}>Waiting for opponent…</Text>
                    <Text style={styles.h2hSub}>They still need to finish their run.</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.loadingText}>Loading Cyber Road…</Text>
            <Text style={styles.loadingSub}>
              {CYBER_ROAD_STUDIO} · Preparing models, audio, and textures.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: CyberRoadUi.bgRoot,
  },
  safeTop: {
    backgroundColor: 'rgba(6, 6, 16, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.25)',
    zIndex: 10,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
  },
  backTxt: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: runitFont.black,
  },
  backSub: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: runitFont.bold,
  },
  loadingOverlay: {
    flex: 1,
    minHeight: 0,
    backgroundColor: CyberRoadUi.bgRoot,
  },
  loadingText: {
    color: 'rgba(226,232,240,0.92)',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 24,
  },
  loadingSub: {
    color: 'rgba(203,213,225,0.88)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 18,
  },
  h2hOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    paddingHorizontal: 24,
  },
  h2hCard: {
    maxWidth: 360,
    width: '100%',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  h2hTitle: {
    marginTop: 16,
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: runitFont.black,
  },
  h2hSub: {
    marginTop: 8,
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: runitFont.bold,
  },
});
