import type { PrizeCatalogRow } from '@/types/database';
import { getSupabase } from '@/supabase/client';

export async function fetchActivePrizeCatalog(): Promise<PrizeCatalogRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('prize_catalog')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PrizeCatalogRow[];
}
