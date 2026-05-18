import { getSupabase } from '@/supabase/client';

export type OpenAsyncHostChallengeRow = {
  id: string;
  mode: string;
  game_key: string;
  entry_fee_wallet_cents: number;
  listed_prize_usd_cents: number | null;
  host_score: number;
  host_game_type: string;
  duration_ms: number;
  taps: number;
  created_at: string;
  expires_at: string;
};

export type AsyncBattleBoardRow = OpenAsyncHostChallengeRow & {
  /** True when this row belongs to the signed-in user (shown on board, not challengeable). */
  isOwnPostedRun: boolean;
};

const OPEN_BOARD_COLUMNS =
  'id, mode, game_key, entry_fee_wallet_cents, listed_prize_usd_cents, host_score, host_game_type, duration_ms, taps, created_at, expires_at';

function rpcListOpenMissing(error: { code?: string; message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    msg.includes('h2h_async_host_list_open_challenges') ||
    msg.includes('could not find the function') ||
    msg.includes('function public.h2h_async_host_list_open_challenges') ||
    msg.includes('schema cache')
  );
}

async function fetchOwnWaitingAsyncRuns(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
): Promise<OpenAsyncHostChallengeRow[]> {
  const { data, error } = await supabase
    .from('h2h_async_host_pending')
    .select(OPEN_BOARD_COLUMNS)
    .eq('host_user_id', userId)
    .eq('status', 'waiting_opponent')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;
  return (data ?? []) as OpenAsyncHostChallengeRow[];
}

async function fetchOthersOpenAsyncFromTable(
  supabase: ReturnType<typeof getSupabase>,
  params?: { gameKey?: string | null; limit?: number; excludeHostUserId?: string },
): Promise<OpenAsyncHostChallengeRow[]> {
  const limit = Math.min(Math.max(params?.limit ?? 40, 1), 100);
  const gk = params?.gameKey?.trim().toLowerCase();

  let q = supabase
    .from('h2h_async_host_pending')
    .select(OPEN_BOARD_COLUMNS)
    .eq('status', 'waiting_opponent')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  if (params?.excludeHostUserId) {
    q = q.neq('host_user_id', params.excludeHostUserId);
  }

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as OpenAsyncHostChallengeRow[];
  if (gk) {
    rows = rows.filter((r) => r.game_key.trim().toLowerCase() === gk);
  }
  return rows;
}

async function fetchOthersOpenAsyncFromRpc(
  supabase: ReturnType<typeof getSupabase>,
  params?: { gameKey?: string | null; limit?: number },
): Promise<OpenAsyncHostChallengeRow[]> {
  const { data, error } = await supabase.rpc('h2h_async_host_list_open_challenges', {
    p_game_key: params?.gameKey?.trim() ? params.gameKey.trim() : null,
    p_limit: params?.limit ?? 40,
  });
  if (error) throw error;
  return (data ?? []) as OpenAsyncHostChallengeRow[];
}

/**
 * Events 1v1 battle board: your waiting posts + other players' open rows.
 */
export async function fetchAsyncBattleBoard(params: {
  userId: string;
  gameKey?: string | null;
  limit?: number;
}): Promise<{ rows: AsyncBattleBoardRow[]; loadWarning?: string }> {
  const supabase = getSupabase();
  const limit = params.limit ?? 50;
  const gk = params.gameKey?.trim().toLowerCase() ?? null;
  let loadWarning: string | undefined;

  const own = await fetchOwnWaitingAsyncRuns(supabase, params.userId);

  let others: OpenAsyncHostChallengeRow[] = [];
  try {
    others = await fetchOthersOpenAsyncFromRpc(supabase, { gameKey: gk, limit });
  } catch (rpcErr) {
    const rpcMsg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
    if (rpcListOpenMissing(rpcErr as { code?: string; message?: string })) {
      loadWarning =
        'Open-challenge RPC not deployed — using table fallback. Apply migration 00063 on Supabase for full board sync.';
    }
    try {
      others = await fetchOthersOpenAsyncFromTable(supabase, {
        gameKey: gk,
        limit,
        excludeHostUserId: params.userId,
      });
      if (others.length === 0 && !loadWarning) {
        loadWarning =
          'Could not load other players’ runs. Apply migrations 00063 and 00065 on Supabase, then retry.';
      }
    } catch {
      throw rpcErr instanceof Error ? rpcErr : new Error(rpcMsg);
    }
  }

  const ownIds = new Set(own.map((r) => r.id));
  const merged: AsyncBattleBoardRow[] = [
    ...own.map((r) => ({ ...r, isOwnPostedRun: true as const })),
    ...others.filter((r) => !ownIds.has(r.id)).map((r) => ({ ...r, isOwnPostedRun: false as const })),
  ];

  return { rows: merged, loadWarning };
}

/** @deprecated use fetchAsyncBattleBoard */
export async function fetchOpenAsyncHostChallenges(params?: {
  gameKey?: string | null;
  limit?: number;
  excludeHostUserId?: string;
}): Promise<OpenAsyncHostChallengeRow[]> {
  if (!params?.excludeHostUserId) {
    const supabase = getSupabase();
    try {
      return await fetchOthersOpenAsyncFromRpc(supabase, params);
    } catch (e) {
      if (rpcListOpenMissing(e as { code?: string; message?: string })) {
        return fetchOthersOpenAsyncFromTable(supabase, params);
      }
      throw e;
    }
  }
  const { rows } = await fetchAsyncBattleBoard({
    userId: params.excludeHostUserId,
    gameKey: params.gameKey,
    limit: params.limit,
  });
  return rows.filter((r) => !r.isOwnPostedRun);
}

export function invalidateAsyncBattleBoardQueries(
  qc: { invalidateQueries: (opts: { predicate?: (q: { queryKey: readonly unknown[] }) => boolean }) => void },
) {
  void qc.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'openAsyncHostChallenges' || query.queryKey[0] === 'asyncBattleBoard',
  });
}
