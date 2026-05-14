import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { AppButton } from '@/components/ui/AppButton';
import { useAsyncH2hQueueHostSubmission } from '@/hooks/useAsyncH2hQueueHostSubmission';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { useAuthStore } from '@/store/authStore';
import { fetchH2hTapDashScoresForMatch } from '@/services/api/h2hTapDash';
import AudioManager from './core/AudioManager';
import GameScreen from './core/app/GameScreen';
import GameProvider from './core/context/GameProvider';
import { useResolvedValue } from './core/hooks/useResolvedValue';
import ModelLoader from './core/ModelLoader';
import { CYBER_ROAD_STUDIO } from './core/branding';
import { CyberRoadUi } from './core/uiTheme';
import { Countdown } from '@/minigames/ui/Countdown';
import { finalizeDailyScores } from '@/lib/dailyFreeTournament';
import { runitFont } from '@/lib/runitArcadeTheme';
import { useMinigameExitNav } from '@/minigames/ui/useMinigameExitNav';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { AsyncH2hQueueHostLockOverlay } from '@/minigames/ui/AsyncH2hQueueHostLockOverlay';
import type { DailyTournamentBundle } from '@/types/dailyTournamentPlay';
import type { AsyncH2hQueueSubmit, H2hSkillContestBundle, MatchFinishPayload } from '@/types/match';

export default function CyberRoadScreen({
  h2hSkillContest,
  dailyTournament,
  asyncH2hQueueSubmit,
}: {
  h2hSkillContest?: H2hSkillContestBundle;
  dailyTournament?: DailyTournamentBundle;
  asyncH2hQueueSubmit?: AsyncH2hQueueSubmit;
} = {}) {
  useHidePlayTabBar();
  const uid = useAuthStore((s) => s.user?.id);
  const { onHeaderBackPress, replacePrimaryLabel, replaceToPrimaryExit, replaceToHomeTab } = useMinigameExitNav();
  const [fontLoaded] = useFonts({
    retro: require('../../assets/minigames/cyberroad/fonts/retro.ttf'),
  });
  const [audioLoaded, audioError] = useResolvedValue(() => AudioManager.setupAsync());
  const [modelsLoaded, modelsError] = useResolvedValue(() => ModelLoader.loadModels());

  const [sessionKey, setSessionKey] = useState(0);
  const [matchPhase, setMatchPhase] = useState<'countdown' | 'playing' | 'results' | null>(() => {
    if (h2hSkillContest?.asyncHostSkipSubmit) return 'results';
    if (h2hSkillContest || dailyTournament || asyncH2hQueueSubmit) return 'countdown';
    return null;
  });
  const lastRunRef = useRef({ score: 0, durationMs: 0, taps: 0 });
  const dailyCompleteRef = useRef(false);

  const buildH2hBody = useCallback(() => {
    if (!h2hSkillContest) return {};
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
    { skipSubmit: Boolean(h2hSkillContest?.asyncHostSkipSubmit) },
  );

  const getAsyncHostStats = useCallback(
    () => ({
      score: lastRunRef.current.score,
      durationMs: lastRunRef.current.durationMs,
      taps: lastRunRef.current.taps,
    }),
    [],
  );

  const { asyncHostSubmitPhase, resetAsyncSubmission } = useAsyncH2hQueueHostSubmission({
    shouldSubmit: Boolean(asyncH2hQueueSubmit && matchPhase === 'results'),
    asyncH2hQueueSubmit,
    blocked: Boolean(h2hSkillContest || dailyTournament),
    getStats: getAsyncHostStats,
    uid,
  });

  useLayoutEffect(() => {
    if (!h2hSkillContest?.asyncHostSkipSubmit) return;
    let cancelled = false;
    void fetchH2hTapDashScoresForMatch(h2hSkillContest.matchSessionId).then((data) => {
      if (cancelled || data?.self_score == null) return;
      lastRunRef.current = { ...lastRunRef.current, score: data.self_score };
    });
    return () => {
      cancelled = true;
    };
  }, [h2hSkillContest?.asyncHostSkipSubmit, h2hSkillContest?.matchSessionId]);

  const onH2hRunComplete = useCallback(
    (stats: { score: number; durationMs: number; taps: number }) => {
      lastRunRef.current = stats;
      if (dailyTournament) {
        setMatchPhase('results');
        return;
      }
      if (asyncH2hQueueSubmit && !h2hSkillContest) {
        setMatchPhase('results');
        return;
      }
      if (!h2hSkillContest) return;
      setMatchPhase('results');
    },
    [asyncH2hQueueSubmit, h2hSkillContest, dailyTournament],
  );

  const onCountdownDone = useCallback(() => {
    setMatchPhase('playing');
  }, []);

  const assetsReady = Boolean(fontLoaded && audioLoaded && modelsLoaded);
  const contestArcade = Boolean(h2hSkillContest || dailyTournament || asyncH2hQueueSubmit);
  const showGame =
    assetsReady && (!contestArcade || matchPhase === 'playing' || matchPhase === 'results');
  const showCountdownOverlay = Boolean(contestArcade && matchPhase === 'countdown');

  const dailyPayload: MatchFinishPayload | null =
    dailyTournament && matchPhase === 'results'
      ? finalizeDailyScores(
          lastRunRef.current.score,
          dailyTournament.opponentRoundScore,
          dailyTournament.forcedOutcome,
          dailyTournament.localPlayerId,
          dailyTournament.opponentId,
          dailyTournament.scoreVarianceKey,
        )
      : null;

  const onContinueDaily = useCallback(() => {
    if (!dailyTournament || !dailyPayload || dailyCompleteRef.current) return;
    dailyCompleteRef.current = true;
    dailyTournament.onComplete(dailyPayload);
  }, [dailyTournament, dailyPayload]);

  const headerHint = useMemo(
    () =>
      h2hSkillContest
        ? `vs ${h2hSkillContest.opponentDisplayName}`
        : dailyTournament
          ? `vs ${dailyTournament.opponentDisplayName}`
          : replacePrimaryLabel,
    [h2hSkillContest, dailyTournament, replacePrimaryLabel],
  );

  useFocusEffect(
    useCallback(() => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, []),
  );

  const blockGamePointer = Boolean(contestArcade && matchPhase === 'results');

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
            ) : dailyTournament ? (
              <Text style={styles.backSub} numberOfLines={1}>
                vs {dailyTournament.opponentDisplayName}
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
              <View style={styles.gameShell} pointerEvents={blockGamePointer ? 'none' : 'auto'}>
                <GameProvider key={sessionKey}>
                  <GameScreen
                    h2hSkillContest={contestArcade}
                    h2hSuppressGameOver={Boolean(
                      (h2hSkillContest && matchPhase === 'results') ||
                        (dailyTournament && matchPhase === 'results') ||
                        (asyncH2hQueueSubmit && matchPhase === 'results'),
                    )}
                    onH2hRunComplete={contestArcade ? onH2hRunComplete : undefined}
                  />
                </GameProvider>
              </View>
            ) : null}
            <Countdown active={showCountdownOverlay} onComplete={onCountdownDone} />
            {contestArcade && matchPhase === 'results' ? (
              <View style={[styles.h2hOverlay, Platform.OS === 'web' && styles.h2hOverlayWeb]} pointerEvents="auto">
                {dailyTournament && dailyPayload ? (
                  <View style={styles.h2hCard}>
                    <Text style={styles.h2hTitle}>Round result</Text>
                    <Text style={styles.h2hSub}>
                      You vs {dailyTournament.opponentDisplayName}
                    </Text>
                    <Text style={styles.h2hScoreLine}>
                      {dailyPayload.finalScore.self} — {dailyPayload.finalScore.opponent}
                    </Text>
                    <Text style={[styles.h2hOutcome, { color: dailyPayload.winnerId === dailyTournament.localPlayerId ? '#86efac' : '#fda4af' }]}>
                      {dailyPayload.winnerId === dailyTournament.localPlayerId
                        ? 'You take the match and move on.'
                        : 'They take the match — you’re out of today’s event.'}
                    </Text>
                    <AppButton className="mt-5" title="Continue" onPress={onContinueDaily} />
                  </View>
                ) : h2hSkillContest ? (
                  <>
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
                  </>
                ) : asyncH2hQueueSubmit ? (
                  <AsyncH2hQueueHostLockOverlay
                    layout="card"
                    asyncHostSubmitPhase={asyncHostSubmitPhase}
                    scoreLine={`Score: ${lastRunRef.current.score}`}
                    onPlayAgain={() => {
                      resetAsyncSubmission();
                      setSessionKey((k) => k + 1);
                      setMatchPhase('countdown');
                    }}
                    playAgainDisabled={asyncHostSubmitPhase === 'loading'}
                    minigamesLabel={replacePrimaryLabel}
                    onMinigames={replaceToPrimaryExit}
                    onHome={replaceToHomeTab}
                  />
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
  gameShell: {
    flex: 1,
    minHeight: 0,
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
    elevation: 28,
    paddingHorizontal: 24,
  },
  h2hOverlayWeb: {
    zIndex: 9999,
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
  h2hScoreLine: {
    marginTop: 10,
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    fontFamily: runitFont.black,
  },
  h2hOutcome: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: runitFont.black,
  },
});
