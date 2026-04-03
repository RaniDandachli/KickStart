import { FunctionsHttpError } from '@supabase/functions-js';

import { env } from '@/lib/env';
import { getSupabase } from '@/supabase/client';
import type { MatchSessionRow } from '@/types/database';

export type MatchSessionWithPlayers = {
  id: string;
  mode: string;
  status: string;
  player_a_id: string | null;
  player_b_id: string | null;
  winner_user_id: string | null;
  score_a: number;
  score_b: number;
  game_key: string | null;
  player_a_username: string | null;
  player_b_username: string | null;
  player_a_display: string | null;
  player_b_display: string | null;
};

async function parseFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const j = (await error.context.json()) as { error?: string };
      if (j?.error) return j.error;
    } catch {
      /* ignore */
    }
  }
  return error instanceof Error ? error.message : 'Request failed';
}

/** Second test account UUID for mock matchmaking when backend is on (Supabase Dashboard → create user, paste id). */
export function resolveDevOpponentUserId(opponentIdFromStore: string): string | undefined {
  if (opponentIdFromStore === 'mock_opponent_1') {
    return env.EXPO_PUBLIC_DEV_OPPONENT_USER_ID;
  }
  return opponentIdFromStore;
}

export async function createH2hMatchSessionViaEdge(params: {
  mode: 'casual' | 'ranked' | 'custom';
  opponentUserId: string;
  gameKey?: string;
  entryFeeWalletCents?: number;
  listedPrizeUsdCents?: number;
}): Promise<{ match_session_id: string }> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    throw new Error('Sign in to start a ranked match.');
  }
  await supabase.auth.refreshSession();

  const { data, error } = await supabase.functions.invoke('createH2hMatchSession', {
    body: {
      mode: params.mode,
      opponent_user_id: params.opponentUserId,
      game_key: params.gameKey,
      entry_fee_wallet_cents: params.entryFeeWalletCents,
      listed_prize_usd_cents: params.listedPrizeUsdCents,
    },
  });

  if (error) throw new Error(await parseFunctionError(error));

  const payload = data as { ok?: boolean; match_session_id?: string; error?: string };
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.ok || !payload.match_session_id) throw new Error('Could not create match session');

  return { match_session_id: payload.match_session_id };
}

export async function recordH2hMatchResultViaEdge(params: {
  matchSessionId: string;
  winnerUserId: string | null;
  loserUserId: string | null;
  isDraw: boolean;
  score: { a: number; b: number };
  wasRanked?: boolean;
}): Promise<void> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    throw new Error('Not signed in');
  }
  await supabase.auth.refreshSession();

  const body: Record<string, unknown> = {
    match_session_id: params.matchSessionId,
    score: params.score,
    was_ranked: params.wasRanked ?? false,
    is_draw: params.isDraw,
  };
  if (params.isDraw) {
    body.winner_user_id = null;
    body.loser_user_id = null;
  } else {
    body.winner_user_id = params.winnerUserId;
    body.loser_user_id = params.loserUserId;
  }

  const { data, error } = await supabase.functions.invoke('recordMatchResult', { body });

  if (error) throw new Error(await parseFunctionError(error));

  const payload = data as { ok?: boolean; error?: string; idempotent?: boolean };
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.ok && !payload?.idempotent) throw new Error('Could not save match result');
}

export async function fetchMatchSessionWithPlayers(matchSessionId: string): Promise<MatchSessionWithPlayers | null> {
  const supabase = getSupabase();
  const { data: ms, error } = await supabase.from('match_sessions').select('*').eq('id', matchSessionId).maybeSingle();
  if (error) throw error;
  if (!ms) return null;

  const row = ms as MatchSessionRow;
  const pa = row.player_a_id;
  const pb = row.player_b_id;
  const ids = [pa, pb].filter(Boolean) as string[];
  if (ids.length === 0) {
    return {
      id: row.id,
      mode: row.mode,
      status: row.status,
      player_a_id: row.player_a_id,
      player_b_id: row.player_b_id,
      winner_user_id: row.winner_user_id,
      score_a: row.score_a,
      score_b: row.score_b,
      game_key: row.game_key ?? null,
      player_a_username: null,
      player_b_username: null,
      player_a_display: null,
      player_b_display: null,
    };
  }

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id,username,display_name')
    .in('id', ids);
  if (pErr) throw pErr;

  const map = new Map((profiles ?? []).map((p) => [p.id, p]));
  const a = pa ? map.get(pa) : undefined;
  const b = pb ? map.get(pb) : undefined;

  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    player_a_id: row.player_a_id,
    player_b_id: row.player_b_id,
    winner_user_id: row.winner_user_id,
    score_a: row.score_a,
    score_b: row.score_b,
    game_key: row.game_key ?? null,
    player_a_username: a?.username ?? null,
    player_b_username: b?.username ?? null,
    player_a_display: a?.display_name ?? null,
    player_b_display: b?.display_name ?? null,
  };
}

export function displayNameForProfile(username: string | null | undefined, displayName: string | null | undefined): string {
  const d = displayName?.trim();
  if (d) return d;
  return username?.trim() || 'Player';
}
