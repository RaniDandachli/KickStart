import { getSupabase } from '@/supabase/client';

/** Unlock paid Money Challenge for this local calendar day (wallet debit once per day/challenge). */
export async function enterMoneyChallengeWallet(
  challengeId: string,
  calendarDay: string,
): Promise<{ ok: boolean; error?: string; paidCents?: number }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('enter_money_challenge_wallet', {
    p_challenge_id: challengeId,
    p_calendar_day: calendarDay,
  });
  if (error) return { ok: false, error: error.message };
  const row = data as {
    ok?: boolean;
    error?: string;
    paid_cents?: number;
    already_unlocked?: boolean;
  };
  if (row?.ok === false) return { ok: false, error: row.error ?? 'unknown' };
  const pc = typeof row?.paid_cents === 'number' ? row.paid_cents : undefined;
  return {
    ok: true,
    paidCents: pc,
  };
}
