import { getSupabase } from '@/supabase/client';
import type { WeeklyRaceEntryRow } from '@/types/database';
import type { H2hGameKey } from '@/lib/homeOpenMatches';

type RpcResult = { ok: boolean; error?: string; attempts_used?: number; best_score?: number };

function parseRpcRow(data: unknown): RpcResult {
  const row = data as { ok?: boolean; error?: string; attempts_used?: number; best_score?: number };
  if (row?.ok === false) {
    return { ok: false, error: row.error ?? 'unknown' };
  }
  return {
    ok: true,
    attempts_used: row?.attempts_used,
    best_score: row?.best_score,
  };
}

export async function enterWeeklyRaceClient(
  dayKey: string,
  gameKey: H2hGameKey,
): Promise<RpcResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('enter_weekly_race', {
    p_day_key: dayKey,
    p_game_key: gameKey,
  });
  if (error) return { ok: false, error: error.message };
  return parseRpcRow(data);
}

export async function recordWeeklyRaceScoreClient(
  dayKey: string,
  gameKey: H2hGameKey,
  score: number,
): Promise<RpcResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('record_weekly_race_score', {
    p_day_key: dayKey,
    p_game_key: gameKey,
    p_score: Math.floor(score),
  });
  if (error) return { ok: false, error: error.message };
  return parseRpcRow(data);
}

export async function fetchWeeklyRaceEntry(
  dayKey: string,
): Promise<WeeklyRaceEntryRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('weekly_race_entries')
    .select('*')
    .eq('day_key', dayKey)
    .maybeSingle();
  if (error) throw error;
  return data as WeeklyRaceEntryRow | null;
}

/** Run once after login / opening Events — credits top-3 wallet prizes for unsettled past days (UTC-eligible). */
export async function finalizeWeeklyRacePendingDaysClient(): Promise<{
  ok: boolean;
  error?: string;
  you_received_cents?: number;
}> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('finalize_weekly_race_pending_days');
  if (error) return { ok: false, error: error.message };
  const row = data as {
    ok?: boolean;
    you_received_cents?: number;
  };
  return {
    ok: row.ok !== false,
    you_received_cents: typeof row.you_received_cents === 'number' ? row.you_received_cents : 0,
  };
}
