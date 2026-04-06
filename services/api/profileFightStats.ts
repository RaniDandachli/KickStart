import { getSupabase } from '@/supabase/client';

export type ProfileFightStats = {
  wins: number;
  losses: number;
  current_streak: number;
  best_streak: number;
  matches_played: number;
  wins_rank: number;
};

export async function fetchProfileFightStats(userId: string): Promise<ProfileFightStats | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('profile_fight_stats', { p_user_id: userId });
  if (error) {
    console.warn('[profileFightStats]', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  return {
    wins: Number(r.wins ?? 0),
    losses: Number(r.losses ?? 0),
    current_streak: Number(r.current_streak ?? 0),
    best_streak: Number(r.best_streak ?? 0),
    matches_played: Number(r.matches_played ?? 0),
    wins_rank: Number(r.wins_rank ?? 0),
  };
}
