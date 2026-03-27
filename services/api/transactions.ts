import type { TransactionRow } from '@/types/database';
import { getSupabase } from '@/supabase/client';

export async function fetchRecentTransactions(userId: string, limit = 40): Promise<TransactionRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TransactionRow[];
}
