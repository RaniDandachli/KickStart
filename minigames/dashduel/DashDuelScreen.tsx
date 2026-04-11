import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Platform, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/ui/AppButton';
import { Countdown } from '@/minigames/ui/Countdown';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { DashDuelGame } from '@/minigames/dashduel/DashDuelGame';
import { DashDuelLobby } from '@/minigames/dashduel/DashDuelLobby';
import { DashDuelResults } from '@/minigames/dashduel/DashDuelResults';
import { useDashDuelNeonVelocityMusic } from '@/minigames/dashduel/useDashDuelNeonVelocityMusic';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import {
  awardRedeemTicketsForPrizeRun,
  ticketsFromDashDuelDisplayedScore,
} from '@/lib/ticketPayouts';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { useProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/store/authStore';
import { getSupabase } from '@/supabase/client';
import type { H2hSkillContestBundle } from '@/types/match';

type Phase = 'home' | 'lobby' | 'countdown' | 'playing' | 'results';

function nextSeed(): number {
  return (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
}

export default function DashDuelScreen({
  h2hSkillContest,
}: {
  h2hSkillContest?: H2hSkillContestBundle;
} = {}) {
  useHidePlayTabBar();
  useDashDuelNeonVelocityMusic();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const queryClient = useQueryClient();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const { width, height } = useWindowDimensions();
  /** Logical landscape size (matches DashDuelGame) so menu layout doesn’t jump before rotation finishes. */
  const lw = Math.max(width, height);
  const lh = Math.min(width, height);
  const isLandscapeLayout = lw > lh;

  const [phase, setPhase] = useState<Phase>(() => (h2hSkillContest ? 'countdown' : 'home'));
  const [mode, setMode] = useState<'practice' | 'vs'>('practice');
  const [seed, setSeed] = useState(nextSeed);
  const [finalScore, setFinalScore] = useState(0);
  const [finalDistance, setFinalDistance] = useState(0);
  const [ticketsEarned, setTicketsEarned] = useState(0);
  const appliedRouteMode = useRef(false);
  const lastRunRef = useRef({ score: 0, distance: 0, durationMs: 0, jumpCount: 0 });

  const buildH2hBody = useCallback(() => {
    const r = lastRunRef.current;
    return {
      game_type: 'dash_duel' as const,
      score: r.score,
      duration_ms: r.durationMs,
      taps: r.jumpCount,
      match_session_id: h2hSkillContest!.matchSessionId,
    };
  }, [h2hSkillContest]);

  const { h2hSubmitPhase, h2hPoll, setH2hRetryKey } = useH2hSkillContestSubmitAndPoll(
    h2hSkillContest,
    phase,
    buildH2hBody,
    'results',
  );

  const runFlow = phase !== 'home';

  const goPractice = useCallback(() => {
    setMode('practice');
    setSeed(nextSeed());
    setPhase('countdown');
  }, []);

  const goVs = useCallback(() => {
    const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits);
    if (!ok) {
      Alert.alert(
        'Not enough prize credits',
        `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
      );
      return;
    }
    setMode('vs');
    setSeed(nextSeed());
    setPhase('lobby');
  }, [profileQ.data?.prize_credits]);

  useEffect(() => {
    if (h2hSkillContest) return;
    if (appliedRouteMode.current) return;
    const m = String(modeParam ?? '');
    if (m === 'practice') {
      appliedRouteMode.current = true;
      goPractice();
    } else if (m === 'prize') {
      appliedRouteMode.current = true;
      const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits);
      if (!ok) {
        Alert.alert(
          'Not enough prize credits',
          `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
        );
        router.back();
        return;
      }
      setMode('vs');
      setSeed(nextSeed());
      setPhase('lobby');
    }
  }, [h2hSkillContest, modeParam, goPractice, router, profileQ.data?.prize_credits]);

  const lobbyStart = useCallback(() => setPhase('countdown'), []);
  const onCountdownDone = useCallback(() => setPhase('playing'), []);

  const onRoundComplete = useCallback(
    (score: number, distance: number, durationMs: number, jumpCount: number) => {
      if (h2hSkillContest) {
        lastRunRef.current = { score, distance, durationMs, jumpCount };
        setTicketsEarned(0);
        setFinalScore(score);
        setFinalDistance(distance);
        setPhase('results');
        return;
      }
      void (async () => {
        let tickets = 0;
        if (mode === 'vs') {
          if (ENABLE_BACKEND && uid) {
            try {
              const supabase = getSupabase();
              const { data: sess } = await supabase.auth.getSession();
              if (!sess.session) {
                Alert.alert('Sign in required', 'Log in to apply prize credits and redeem tickets.');
              } else {
                const { data, error } = await supabase.functions.invoke('submitMinigameScore', {
                  body: {
                    prize_run: true,
                    game_type: 'dash_duel' as const,
                    score,
                    duration_ms: durationMs,
                    taps: jumpCount,
                  },
                });
                if (error) {
                  Alert.alert('Could not save prize run', error.message ?? 'Try again later.');
                  tickets = ticketsFromDashDuelDisplayedScore(score);
                } else {
                  const row = data as { tickets_granted?: number } | null;
                  tickets = Math.max(
                    0,
                    typeof row?.tickets_granted === 'number'
                      ? row.tickets_granted
                      : ticketsFromDashDuelDisplayedScore(score),
                  );
                  invalidateProfileEconomy(queryClient, uid);
                }
              }
            } catch {
              Alert.alert('Could not save prize run', 'Check your connection and try again.');
              tickets = ticketsFromDashDuelDisplayedScore(score);
            }
          } else if (!ENABLE_BACKEND) {
            const n = ticketsFromDashDuelDisplayedScore(score);
            awardRedeemTicketsForPrizeRun(n);
            tickets = n;
          } else {
            tickets = ticketsFromDashDuelDisplayedScore(score);
          }
        }
        setTicketsEarned(mode === 'vs' ? tickets : 0);
        setFinalScore(score);
        setFinalDistance(distance);
        setPhase('results');
      })();
    },
    [h2hSkillContest, mode, uid, queryClient],
  );

  const rematch = useCallback(() => {
    if (h2hSkillContest) return;
    setFinalScore(0);
    setFinalDistance(0);
    setTicketsEarned(0);
    setSeed(nextSeed());
    setPhase('countdown');
  }, [h2hSkillContest]);

  const exitToMenu = useCallback(() => {
    if (h2hSkillContest) {
      router.back();
      return;
    }
    setFinalScore(0);
    setFinalDistance(0);
    setTicketsEarned(0);
    setPhase('home');
  }, [h2hSkillContest, router]);

  // Lock landscape before first paint; on blur restore portrait so tab shell + minigames list don’t desync.
  useLayoutEffect(() => {
    if (Platform.OS === 'web') return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, []),
  );

  const prizeLabel = h2hSkillContest ? undefined : mode === 'vs' ? 'Prize $9' : undefined;
  const practiceLabel = h2hSkillContest
    ? `Head-to-head · vs ${h2hSkillContest.opponentDisplayName}`
    : mode === 'practice'
      ? 'Practice'
      : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden={runFlow} style="light" />
      <SafeAreaView className="flex-1 bg-[#020617]" edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <View className="relative flex-1" style={{ position: 'relative', flex: 1 }}>
          {!h2hSkillContest && phase === 'home' ? (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                paddingHorizontal: isLandscapeLayout ? 32 : 24,
                flexDirection: isLandscapeLayout ? 'row' : 'column',
                alignItems: 'center',
                gap: isLandscapeLayout ? 32 : 0,
              }}
            >
              <View style={{ flex: isLandscapeLayout ? 1 : undefined, maxWidth: 420, width: '100%' }}>
                <Text className="mb-2 text-center text-3xl font-black text-cyan-300">Dash Duel</Text>
                <Text className="mb-2 text-center text-sm font-semibold text-slate-400">
                  Neon runner · tap to jump · procedural course
                </Text>
                <Text className="mb-8 text-center text-base leading-6 text-slate-300">
                  Landscape run: constant speed like Geometry Dash. Avoid voids, crystals, walls, and lasers. Hit rings
                  while holding jump for a boost.
                </Text>
              </View>
              <View style={{ flex: isLandscapeLayout ? 0.9 : undefined, width: '100%', maxWidth: 360 }}>
                <AppButton title="Practice run (free)" onPress={goPractice} />
                <AppButton
                  className="mt-3"
                  title={`Prize run vs AI · ${PRIZE_RUN_ENTRY_CREDITS} credits`}
                  variant="secondary"
                  onPress={goVs}
                />
                <AppButton className="mt-6" title="Back to arcade" variant="ghost" onPress={() => router.back()} />
              </View>
            </View>
          ) : null}

          {phase === 'lobby' ? <DashDuelLobby onStart={lobbyStart} onBack={() => setPhase('home')} /> : null}

          {phase === 'countdown' || phase === 'playing' ? (
            <View style={{ flex: 1, width: '100%' }}>
              {phase === 'playing' ? (
                <DashDuelGame
                  key={seed}
                  seed={seed}
                  prizeLabel={prizeLabel}
                  practiceLabel={practiceLabel}
                  onExit={() => router.back()}
                  onRoundComplete={onRoundComplete}
                />
              ) : (
                <View className="flex-1 items-center justify-center bg-black">
                  <Text className="mb-6 text-center text-slate-500">Get ready</Text>
                </View>
              )}
            </View>
          ) : null}

          <Countdown active={phase === 'countdown'} onComplete={onCountdownDone} />

          {phase === 'results' ? (
            <DashDuelResults
              visible
              finalScore={finalScore}
              distance={finalDistance}
              seed={seed}
              ticketsEarned={h2hSkillContest ? undefined : mode === 'vs' ? ticketsEarned : undefined}
              hideRematch={Boolean(h2hSkillContest)}
              h2hFooter={
                h2hSkillContest ? (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: 'rgba(148,163,184,0.95)', fontSize: 13, textAlign: 'center' }}>
                      Head-to-head uses your displayed score vs your opponent&apos;s run.
                    </Text>
                    {h2hSubmitPhase === 'loading' ? (
                      <Text style={{ color: 'rgba(148,163,184,0.95)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                        Submitting your run…
                      </Text>
                    ) : null}
                    {h2hSubmitPhase === 'error' ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ color: 'rgba(248,113,113,0.95)', fontSize: 13, textAlign: 'center' }}>
                          Could not submit this run.
                        </Text>
                        <AppButton title="Retry submit" className="mt-2" onPress={() => setH2hRetryKey((k) => k + 1)} />
                      </View>
                    ) : null}
                    {h2hSubmitPhase === 'ok' && !h2hPoll?.both_submitted ? (
                      <Text style={{ color: 'rgba(148,163,184,0.95)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                        Waiting for {h2hSkillContest.opponentDisplayName} to finish…
                      </Text>
                    ) : null}
                    {h2hSubmitPhase === 'ok' && h2hPoll?.both_submitted ? (
                      <Text style={{ color: 'rgba(148,163,184,0.95)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                        Both runs in — finalizing match…
                      </Text>
                    ) : null}
                  </View>
                ) : undefined
              }
              onRematch={rematch}
              onExit={exitToMenu}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
