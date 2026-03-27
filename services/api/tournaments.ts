import type { TournamentRow, TournamentRuleRow } from '@/types/database';
import { getSupabase } from '@/supabase/client';

export async function fetchTournaments(openOnly = false): Promise<TournamentRow[]> {
  const supabase = getSupabase();
  let q = supabase.from('tournaments').select('*').order('starts_at', { ascending: true });
  if (openOnly) q = q.in('state', ['open', 'full']);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TournamentRow[];
}

export async function fetchTournamentById(id: string): Promise<TournamentRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as TournamentRow | null;
}

export async function fetchTournamentRules(tournamentId: string): Promise<TournamentRuleRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tournament_rules')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TournamentRuleRow[];
}

export async function joinTournamentOptimistic(
  tournamentId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('tournament_entries').insert({
    tournament_id: tournamentId,
    user_id: userId,
    status: 'registered',
  });
  if (error) throw error;
}
