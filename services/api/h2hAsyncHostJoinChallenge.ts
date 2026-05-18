import type { Router } from 'expo-router';

import { pushCrossTab } from '@/lib/appNavigation';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { queryKeys } from '@/lib/queryKeys';
import type { QueryClient } from '@tanstack/react-query';
import { displayNameForProfile } from '@/services/api/h2hMatchSession';
import { h2hJoinSpecificAsyncHostChallenge } from '@/services/matchmaking/h2hQueue';
import { getSupabase } from '@/supabase/client';
import { useMatchmakingStore } from '@/store/matchmakingStore';

export type JoinAsyncChallengeTier = {
  entryFeeWalletCents: number;
  listedPrizeUsdCents: number | null;
};

function joinErrorMessage(code: string, detail?: string): string {
  switch (code) {
    case 'insufficient_wallet':
      return 'Not enough cash in your wallet for this entry. Add funds and try again.';
    case 'async_host_pending':
      return 'You already have an open async run waiting for an opponent. Cancel it in Your async runs first.';
    case 'async_already_matched':
      return 'Someone else just picked this one up. Refresh the board.';
    case 'async_expired':
      return 'This challenge expired. Refresh for newer runs.';
    case 'cannot_challenge_own_run':
      return 'That is your own posted score — pick a different row.';
    case 'not_authenticated':
      return 'Sign in to continue.';
    case 'match_create_failed':
      return detail
        ? `Could not start this contest: ${detail}`
        : 'Could not start this contest. Check wallet balance and try again.';
    case 'unexpected_join_shape':
      return 'Server returned an unexpected response. Refresh and try again.';
    default:
      return detail ? `${code}: ${detail}` : 'Could not join this challenge. Try again.';
  }
}

/**
 * Join an async-host board row (debits joiner entry), then open the skill match on the Play tab.
 */
export async function joinAsyncChallengeAndOpenMatch(opts: {
  pendingId: string;
  tier: JoinAsyncChallengeTier;
  router: Router;
  queryClient: QueryClient;
  userId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await h2hJoinSpecificAsyncHostChallenge(opts.pendingId);
  if (!r.ok) {
    return { ok: false, message: joinErrorMessage(r.error, r.detail) };
  }
  if (!r.matched) {
    return { ok: false, message: joinErrorMessage('unexpected_join_shape') };
  }

  let opponentName = 'Opponent';
  try {
    const supabase = getSupabase();
    const { data: prof } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', r.opponent_user_id)
      .maybeSingle();
    opponentName = displayNameForProfile(prof?.username ?? null, prof?.display_name ?? null);
  } catch {
    /* keep default */
  }

  const entryUsd = opts.tier.entryFeeWalletCents / 100;
  const prizeUsd = (opts.tier.listedPrizeUsdCents ?? 0) / 100;

  useMatchmakingStore.getState().setQueuePollSnapshot(null);
  useMatchmakingStore.getState().setKeepSearchingWhenAway(false);
  useMatchmakingStore.getState().setPhase('in_match');
  useMatchmakingStore.getState().setActiveMatch({
    matchId: r.match_session_id,
    opponent: {
      id: r.opponent_user_id,
      username: opponentName,
      rating: 1500,
      region: 'NA',
    },
    entryFeeUsd: entryUsd > 0 ? entryUsd : undefined,
    listedPrizeUsd: prizeUsd > 0 ? prizeUsd : undefined,
  });

  void invalidateProfileEconomy(opts.queryClient, opts.userId);
  void opts.queryClient.invalidateQueries({ queryKey: queryKeys.matchSession(r.match_session_id) });

  pushCrossTab(opts.router, `/(app)/(tabs)/play/match/${r.match_session_id}` as never);

  return { ok: true };
}
