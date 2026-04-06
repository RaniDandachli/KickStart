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
  entry_fee_wallet_cents: number;
  listed_prize_usd_cents: number | null;
  player_a_username: string | null;
  player_b_username: string | null;
  player_a_display: string | null;
  player_b_display: string | null;
};

export type RecordH2hMatchResultResponse = {
  ok?: boolean;
  idempotent?: boolean;
  error?: string;
  /** Arcade Credits (`prize_credits`) granted to the caller as H2H loser consolation. */
  loss_consolation_credits?: number;
  /** Cash wallet (cents) credited to caller as H2H winner prize. */
  prize_wallet_cents_added?: number;
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

export type H2hEnterMatchPlayResult =
  | { ok: true; status: string; already?: boolean }
  | { ok: false; error: string; status?: string };

/** Mark H2H session as `in_progress` when opening play (`lobby` → `in_progress`). Idempotent. */
export type H2hAbandonMatchSessionResult =
  | { ok: true; noop?: boolean; reason?: string; refunded_wallet_cents_each?: number }
  | { ok: false; error: string; status?: string };

/** Cancel H2H from lobby (refunds paid entry for both players). No-op if already completed/cancelled. */
export async function h2hAbandonMatchSessionRpc(matchSessionId: string): Promise<H2hAbandonMatchSessionResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('h2h_abandon_match_session', {
    p_match_session_id: matchSessionId,
  });
  if (error) throw new Error(error.message);
  const j = data as Record<string, unknown>;
  if (j?.ok !== true) {
    return {
      ok: false,
      error: String(j?.error ?? 'abandon_failed'),
      status: typeof j?.status === 'string' ? j.status : undefined,
    };
  }
  const refunded = j.refunded_wallet_cents_each;
  return {
    ok: true,
    noop: j?.noop === true,
    reason: typeof j?.reason === 'string' ? j.reason : undefined,
    refunded_wallet_cents_each:
      typeof refunded === 'number'
        ? refunded
        : refunded != null && refunded !== ''
          ? Number(refunded)
          : undefined,
  };
}

export async function h2hEnterMatchPlayRpc(matchSessionId: string): Promise<H2hEnterMatchPlayResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('h2h_enter_match_play', {
    p_match_session_id: matchSessionId,
  });
  if (error) throw new Error(error.message);
  const j = data as Record<string, unknown>;
  if (j?.ok !== true) {
    return {
      ok: false,
      error: String(j?.error ?? 'enter_match_failed'),
      status: typeof j?.status === 'string' ? j.status : undefined,
    };
  }
  return {
    ok: true,
    status: String(j?.status ?? 'in_progress'),
    already: j?.already === true,
  };
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
}): Promise<RecordH2hMatchResultResponse> {
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

  const payload = data as RecordH2hMatchResultResponse;
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.ok && !payload?.idempotent) throw new Error('Could not save match result');
  return payload;
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
      entry_fee_wallet_cents: row.entry_fee_wallet_cents ?? 0,
      listed_prize_usd_cents: row.listed_prize_usd_cents ?? null,
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
    entry_fee_wallet_cents: row.entry_fee_wallet_cents ?? 0,
    listed_prize_usd_cents: row.listed_prize_usd_cents ?? null,
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
