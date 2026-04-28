import { getSupabase } from '@/supabase/client';

/** Same value Edge uses: `platform_economy.withdraw_platform_fee_bps` (no client .env). */
export async function fetchWithdrawPlatformFeeBps(): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('get_withdraw_platform_fee_bps');
  if (error || data == null) return 0;
  const n = typeof data === 'number' ? data : Number(data);
  return Number.isFinite(n) && n >= 0 && n <= 9999 ? Math.floor(n) : 0;
}
