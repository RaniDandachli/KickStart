import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useH2hSkillContestSubmitAndPoll } from '@/hooks/useH2hSkillContestSubmitAndPoll';
import { useProfile } from '@/hooks/useProfile';
import { alertInsufficientPrizeCredits } from '@/lib/arcadeCreditsShop';
import { consumePrizeRunEntryCredits, PRIZE_RUN_ENTRY_CREDITS } from '@/lib/arcadeEconomy';
import { beginMinigamePrizeRun } from '@/lib/beginMinigamePrizeRun';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { assertBackendPrizeSignedIn, assertPrizeRunReservation } from '@/lib/prizeRunGuards';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';
import { awardRedeemTicketsForPrizeRun, ticketsFromNeonShipScore } from '@/lib/ticketPayouts';
import { NeonShipGame } from '@/minigames/neonship/NeonShipGame';
import { NeonShipLobby } from '@/minigames/neonship/NeonShipLobby';
import { NeonShipResults } from '@/minigames/neonship/NeonShipResults';
import { Countdown } from '@/minigames/ui/Countdown';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';
import { useWebGameKeyboard } from '@/minigames/ui/useWebGameKeyboard';
import { useAuthStore } from '@/store/authStore';
import { getSupabase } from '@/supabase/client';
import type { H2hSkillContestBundle } from '@/types/match';

type Phase = 'home' | 'lobby' | 'countdown' | 'playing' | 'results';

function nextSeed(): number {
  return (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
}

export default function NeonShipScreen({
  h2hSkillContest,
}: {
  h2hSkillContest?: H2hSkillContestBundle;
} = {}) {
  useHidePlayTabBar();
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(uid);
  const queryClient = useQueryClient();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();

  const [phase, setPhase] = useState<Phase>(() => (h2hSkillContest ? 'countdown' : 'home'));
  const [mode, setMode] = useState<'practice' | 'vs'>('practice');
  const [seed, setSeed] = useState(nextSeed);
  const [finalScore, setFinalScore] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [ticketsEarned, setTicketsEarned] = useState(0);
  const appliedRouteMode = useRef(false);
  const prizeRunReservationRef = useRef<string | null>(null);
  const lastRunRef = useRef({ score: 0, durationMs: 0, tapCount: 0 });

  const buildH2hBody = useCallback(() => {
    const r = lastRunRef.current;
    return {
      game_type: 'neon_ship' as const,
      score: r.score,
      duration_ms: r.durationMs,
      taps: r.tapCount,
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
    setMode('vs');
    setSeed(nextSeed());
    setPhase('lobby');
  }, []);

  useEffect(() => {
    if (h2hSkillContest) return;
    if (appliedRouteMode.current) return;
    const m = String(modeParam ?? '');
    if (m === 'practice') {
      appliedRouteMode.current = true;
      goPractice();
    } else if (m === 'prize') {
      appliedRouteMode.current = true;
      setMode('vs');
      setSeed(nextSeed());
      setPhase('lobby');
    }
  }, [h2hSkillContest, modeParam, goPractice]);

  const lobbyStart = useCallback(async () => {
    if (mode === 'vs') {
      if (ENABLE_BACKEND) {
        if (!assertBackendPrizeSignedIn(ENABLE_BACKEND, uid)) return;
        const r = await beginMinigamePrizeRun('neon_ship');
        if (!r.ok) {
          if (r.error === 'insufficient_credits') {
            alertInsufficientPrizeCredits(
              router,
              `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
            );
          } else {
            Alert.alert('Could not start prize run', r.message ?? 'Try again.');
          }
          return;
        }
        prizeRunReservationRef.current = r.reservationId;
        if (uid) invalidateProfileEconomy(queryClient, uid);
      } else {
        const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits);
        if (!ok) {
          alertInsufficientPrizeCredits(
            router,
            `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
          );
          return;
        }
      }
    }
    setPhase('countdown');
  }, [mode, profileQ.data?.prize_credits, queryClient, router, uid]);

  const onCountdownDone = useCallback(() => setPhase('playing'), []);

  useWebGameKeyboard(Platform.OS === 'web' && (phase === 'home' || phase === 'lobby'), {
    Space: (down) => {
      if (!down) return;
      if (phase === 'home') goPractice();
      else void lobbyStart();
    },
  });

  const onRunComplete = useCallback(
    (score: number, dur: number, taps: number) => {
      if (h2hSkillContest) {
        lastRunRef.current = { score, durationMs: dur, tapCount: taps };
        setTicketsEarned(0);
        setFinalScore(score);
        setDurationMs(dur);
        setTapCount(taps);
        setPhase('results');
        return;
      }
      void (async () => {
        let tickets = 0;
        if (mode === 'vs') {
          if (ENABLE_BACKEND) {
            if (!assertBackendPrizeSignedIn(ENABLE_BACKEND, uid)) {
              tickets = ticketsFromNeonShipScore(score);
            } else {
              try {
                const supabase = getSupabase();
                const { data: sess } = await supabase.auth.getSession();
                if (!sess.session) {
                  Alert.alert('Sign in required', 'Log in to apply prize credits and redeem tickets.');
                  tickets = ticketsFromNeonShipScore(score);
                } else if (!assertPrizeRunReservation(true, ENABLE_BACKEND, prizeRunReservationRef.current)) {
                  tickets = ticketsFromNeonShipScore(score);
                } else {
                  const rid = prizeRunReservationRef.current!;
                  const { data, error } = await invokeEdgeFunction('submitMinigameScore', {
                    body: {
                      prize_run: true,
                      prize_run_reservation_id: rid,
                      game_type: 'neon_ship' as const,
                      score,
                      duration_ms: dur,
                      taps,
                    },
                  });
                  if (error) {
                    Alert.alert('Could not save prize run', error.message ?? 'Try again later.');
                    tickets = ticketsFromNeonShipScore(score);
                  } else {
                    const row = data as { tickets_granted?: number } | null;
                    tickets = Math.max(
                      0,
                      typeof row?.tickets_granted === 'number'
                        ? row.tickets_granted
                        : ticketsFromNeonShipScore(score),
                    );
                    if (uid) invalidateProfileEconomy(queryClient, uid);
                  }
                }
              } catch {
                Alert.alert('Could not save prize run', 'Check your connection and try again.');
                tickets = ticketsFromNeonShipScore(score);
              }
            }
          } else {
            const n = ticketsFromNeonShipScore(score);
            awardRedeemTicketsForPrizeRun(n);
            tickets = n;
          }
        }
        setTicketsEarned(mode === 'vs' ? tickets : 0);
        setFinalScore(score);
        setDurationMs(dur);
        setTapCount(taps);
        setPhase('results');
      })();
    },
    [h2hSkillContest, mode, uid, queryClient],
  );

  const rematch = useCallback(() => {
    if (h2hSkillContest) return;
    void (async () => {
      if (mode === 'vs') {
        if (ENABLE_BACKEND) {
          if (!assertBackendPrizeSignedIn(ENABLE_BACKEND, uid)) return;
          const r = await beginMinigamePrizeRun('neon_ship');
          if (!r.ok) {
            if (r.error === 'insufficient_credits') {
              alertInsufficientPrizeCredits(
                router,
                `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
              );
            } else {
              Alert.alert('Could not start prize run', r.message ?? 'Try again.');
            }
            return;
          }
          prizeRunReservationRef.current = r.reservationId;
          if (uid) invalidateProfileEconomy(queryClient, uid);
        } else {
          const ok = consumePrizeRunEntryCredits(profileQ.data?.prize_credits);
          if (!ok) {
            alertInsufficientPrizeCredits(
              router,
              `Prize runs cost ${PRIZE_RUN_ENTRY_CREDITS} prize credits. Practice is free.`,
            );
            return;
          }
        }
      }
      setFinalScore(0);
      setDurationMs(0);
      setTapCount(0);
      setTicketsEarned(0);
      setSeed(nextSeed());
      setPhase('countdown');
    })();
  }, [h2hSkillContest, mode, profileQ.data?.prize_credits, queryClient, router, uid]);

  useWebGameKeyboard(Platform.OS === 'web' && phase === 'results' && !h2hSkillContest, {
    Space: (down) => {
      if (!down) return;
      rematch();
    },
    Enter: (down) => {
      if (!down) return;
      rematch();
    },
  });

  const exitToMenu = useCallback(() => {
    if (h2hSkillContest) {
      router.back();
      return;
    }
    setFinalScore(0);
    setDurationMs(0);
    setTapCount(0);
    setTicketsEarned(0);
    setPhase('home');
  }, [h2hSkillContest, router]);

  const prizeLabel = h2hSkillContest ? undefined : mode === 'vs' ? 'Prize run' : undefined;
  const practiceLabel = h2hSkillContest
    ? `Head-to-head · vs ${h2hSkillContest.opponentDisplayName}`
    : mode === 'practice'
      ? 'Practice'
      : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar hidden={runFlow} style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, position: 'relative' }}>
          {!h2hSkillContest && phase === 'home' ? (
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
              <Text style={{ textAlign: 'center', fontSize: 28, fontWeight: '900', color: '#c4b5fd', marginBottom: 8 }}>
                Void Glider
              </Text>
              <Text style={{ textAlign: 'center', fontSize: 13, color: 'rgba(148,163,184,0.95)', marginBottom: 20 }}>
                Endless neon ship flight — thrust up, fall down, thread the gaps and dodge spikes.
              </Text>
              <AppButton title="Practice run (free)" onPress={goPractice} />
              {Platform.OS === 'web' ? (
                <Text style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 8 }}>
                  Space — start practice
                </Text>
              ) : null}
              <AppButton
                className="mt-3"
                title={`Prize run vs AI · ${PRIZE_RUN_ENTRY_CREDITS} credits`}
                variant="secondary"
                onPress={goVs}
              />
              <AppButton className="mt-6" title="Back to arcade" variant="ghost" onPress={() => router.back()} />
            </View>
          ) : null}

          {phase === 'lobby' ? (
            <NeonShipLobby onStart={() => void lobbyStart()} onBack={() => setPhase('home')} />
          ) : null}

          {phase === 'countdown' || phase === 'playing' ? (
            <View style={{ flex: 1, width: '100%' }}>
              {phase === 'playing' ? (
                <NeonShipGame
                  key={seed}
                  seed={seed}
                  subtitle={prizeLabel ?? practiceLabel}
                  skipStartOverlay={Boolean(h2hSkillContest)}
                  onExit={() => router.back()}
                  onRunComplete={onRunComplete}
                />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                  <Text style={{ color: '#64748b', marginBottom: 12 }}>Get ready</Text>
                </View>
              )}
            </View>
          ) : null}

          <Countdown active={phase === 'countdown'} onComplete={onCountdownDone} />

          {phase === 'results' ? (
            <NeonShipResults
              visible
              finalScore={finalScore}
              durationMs={durationMs}
              tapCount={tapCount}
              seed={seed}
              ticketsEarned={h2hSkillContest ? undefined : mode === 'vs' ? ticketsEarned : undefined}
              hideRematch={Boolean(h2hSkillContest)}
              h2hFooter={
                h2hSkillContest ? (
                  <View style={{ marginBottom: 12, marginTop: 8 }}>
                    <Text style={{ color: 'rgba(148,163,184,0.95)', fontSize: 13, textAlign: 'center' }}>
                      Head-to-head: higher distance wins after both runs submit.
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