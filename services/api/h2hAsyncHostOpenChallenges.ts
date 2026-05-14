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

export async function fetchOpenAsyncHostChallenges(params?: {
  gameKey?: string | null;
  limit?: number;
}): Promise<OpenAsyncHostChallengeRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('h2h_async_host_list_open_challenges', {
    p_game_key: params?.gameKey?.trim() ? params.gameKey.trim() : null,
    p_limit: params?.limit ?? 40,
  });
  if (error) throw error;
  return (data ?? []) as OpenAsyncHostChallengeRow[];
}
