import { getSupabase } from '@/supabase/client';

export type RecentMatchFeedItem = {
  match_id: string;
  ended_at: string;
  is_draw: boolean;
  won: boolean;
  opponent_username: string;
  opponent_display_name: string;
  score_for: number;
  score_against: number;
  game_key: string | null;
};

function parseFeed(data: unknown): RecentMatchFeedItem[] {
  if (!Array.isArray(data)) return [];
  return data.filter(Boolean).map((raw) => {
    const o = raw as Record<string, unknown>;
    return {
      match_id: String(o.match_id ?? ''),
      ended_at: String(o.ended_at ?? ''),
      is_draw: Boolean(o.is_draw),
      won: Boolean(o.won),
      opponent_username: String(o.opponent_username ?? ''),
      opponent_display_name: String(o.opponent_display_name ?? ''),
      score_for: Number(o.score_for ?? 0),
      score_against: Number(o.score_against ?? 0),
      game_key: o.game_key != null ? String(o.game_key) : null,
    };
  });
}

export async function fetchRecentMatchFeed(limit = 10): Promise<RecentMatchFeedItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('recent_match_feed', { p_limit: limit });
  if (error) {
    console.warn('[recentMatchFeed]', error.message);
    return [];
  }
  return parseFeed(data);
}
