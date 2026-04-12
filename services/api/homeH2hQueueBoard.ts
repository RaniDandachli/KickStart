import { MATCH_ENTRY_TIERS } from '@/components/arcade/matchEntryTiers';
import { H2H_OPEN_GAMES, type H2hGameKey } from '@/lib/homeOpenMatches';
import type { H2hBoardWaiter } from '@/store/homeH2hBoardStore';
import { getSupabase } from '@/supabase/client';

export type HomeH2hQueueBoardRow = {
  queue_entry_id: string;
  game_key: string;
  entry_fee_wallet_cents: number;
  listed_prize_usd_cents: number;
  host_display_name: string;
  created_at: string;
};

export async function fetchHomeH2hQueueBoard(): Promise<HomeH2hQueueBoardRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('home_h2h_queue_board');
  if (error) throw error;
  return (data ?? []) as HomeH2hQueueBoardRow[];
}

function isOpenGameKey(k: string): k is H2hGameKey {
  return H2H_OPEN_GAMES.some((g) => g.gameKey === k);
}

/** Map DB row → store waiter; skips unknown game keys or impossible tier combos. */
export function mapQueueBoardRowToWaiter(row: HomeH2hQueueBoardRow): H2hBoardWaiter | null {
  if (!isOpenGameKey(row.game_key)) return null;
  const entryCents = Math.max(0, Math.round(Number(row.entry_fee_wallet_cents)));
  const prizeCents = Math.max(0, Math.round(Number(row.listed_prize_usd_cents)));

  let tierIndex = MATCH_ENTRY_TIERS.findIndex(
    (t) => Math.round(t.entry * 100) === entryCents && Math.round(t.prize * 100) === prizeCents,
  );
  if (tierIndex < 0) {
    tierIndex = MATCH_ENTRY_TIERS.findIndex((t) => Math.round(t.entry * 100) === entryCents);
  }
  if (tierIndex < 0) return null;

  return {
    id: row.queue_entry_id,
    gameKey: row.game_key,
    tierIndex,
    hostLabel: row.host_display_name || 'Player',
    postedAt: new Date(row.created_at).getTime(),
  };
}

export async function fetchHomeH2hQueueBoardWaiters(): Promise<H2hBoardWaiter[]> {
  const rows = await fetchHomeH2hQueueBoard();
  const out: H2hBoardWaiter[] = [];
  for (const row of rows) {
    const w = mapQueueBoardRowToWaiter(row);
    if (w) out.push(w);
  }
  return out;
}
