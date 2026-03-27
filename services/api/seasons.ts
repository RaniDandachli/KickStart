import type { SeasonRow } from '@/types/database';
import { getSupabase } from '@/supabase/client';

export async function fetchActiveSeason(): Promise<SeasonRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('seasons').select('*').eq('is_active', true).maybeSingle();
  if (error) throw error;
  return data as SeasonRow | null;
}
