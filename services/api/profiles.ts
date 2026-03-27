import type { ProfileRow } from '@/types/database';
import { getSupabase } from '@/supabase/client';

export async function fetchProfileById(userId: string): Promise<ProfileRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function updateProfileFields(
  userId: string,
  patch: Pick<ProfileRow, 'display_name' | 'region' | 'avatar_url'>
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}
