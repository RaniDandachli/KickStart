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

async function fetchOpenAsyncHostChallengesFromTable(
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

export async function fetchOpenAsyncHostChallenges(params?: {
  gameKey?: string | null;
  limit?: number;
  /** Current user — their own waiting row is excluded from the public board. */
  excludeHostUserId?: string;
}): Promise<OpenAsyncHostChallengeRow[]> {
  const supabase = getSupabase();
  const limit = params?.limit ?? 40;
  const pGameKey = params?.gameKey?.trim() ? params.gameKey.trim() : null;

  const { data, error } = await supabase.rpc('h2h_async_host_list_open_challenges', {
    p_game_key: pGameKey,
    p_limit: limit,
  });

  if (!error) {
    return (data ?? []) as OpenAsyncHostChallengeRow[];
  }

  if (rpcListOpenMissing(error)) {
    return fetchOpenAsyncHostChallengesFromTable(supabase, params);
  }

  try {
    return await fetchOpenAsyncHostChallengesFromTable(supabase, params);
  } catch {
    throw error;
  }
}
