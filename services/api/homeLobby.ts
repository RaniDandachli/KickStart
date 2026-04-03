import { getSupabase } from '@/supabase/client';

export type HomeLobbyRecentReward = {
  username: string;
  cents: number;
  created_at: string;
};

export type HomeLobbyRecentArcade = {
  username: string;
  score: number;
  game_type: string;
  created_at: string;
};

export type HomeLobbyStats = {
  players_online: number;
  rewards_wallet_cents_24h: number;
  matches_in_progress: number;
  matches_queued: number;
  recent_rewards: HomeLobbyRecentReward[];
  recent_arcade: HomeLobbyRecentArcade[];
};

export async function fetchHomeLobbyStats(): Promise<HomeLobbyStats | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('home_lobby_stats');
  if (error) {
    console.warn('[homeLobby]', error.message);
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  return {
    players_online: Number(row.players_online ?? 0),
    rewards_wallet_cents_24h: Number(row.rewards_wallet_cents_24h ?? 0),
    matches_in_progress: Number(row.matches_in_progress ?? 0),
    matches_queued: Number(row.matches_queued ?? 0),
    recent_rewards: Array.isArray(row.recent_rewards) ? (row.recent_rewards as HomeLobbyRecentReward[]) : [],
    recent_arcade: Array.isArray(row.recent_arcade) ? (row.recent_arcade as HomeLobbyRecentArcade[]) : [],
  };
}
