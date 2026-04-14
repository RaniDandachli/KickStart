import { useEffect, useRef, type MutableRefObject } from 'react';

import { getSupabase } from '@/supabase/client';
import { H2H_QUICK_MATCH_GAME_KEY } from '@/lib/homeOpenMatches';
import { displayNameForProfile } from '@/services/api/h2hMatchSession';
import { useMatchmakingStore, type QueueKind } from '@/store/matchmakingStore';

export type H2hQueueParamsRef = MutableRefObject<{
  mode: QueueKind;
  gameKey: string;
  entryFeeWalletCents: number;
  listedPrizeUsdCents: number;
  /** Quick Match wildcard: max entry fee (cents) user can pay — required to validate realtime rows. */
  maxAffordableEntryCents?: number;
} | null>;

function normGameKey(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function rowMatchesQueueParams(row: Record<string, unknown>, p: NonNullable<H2hQueueParamsRef['current']>): boolean {
  if (row.mode !== p.mode) return false;
  // Realtime payloads sometimes omit `status`; treat missing as lobby (same as new H2H sessions).
  const st = row.status;
  if (st != null && st !== '' && st !== 'lobby') return false;
  // Quick Match wildcard: only accept sessions whose contest access fee is affordable (same rule as RPC pairing).
  if (p.gameKey === H2H_QUICK_MATCH_GAME_KEY) {
    const max = p.maxAffordableEntryCents ?? 0;
    const rowEntry = Number(row.entry_fee_wallet_cents ?? 0);
    if (rowEntry > max) return false;
    const gk = normGameKey(row.game_key);
    if (gk == null || gk === '' || gk === H2H_QUICK_MATCH_GAME_KEY) return false;
    return true;
  }
  if (Number(row.entry_fee_wallet_cents ?? 0) !== p.entryFeeWalletCents) return false;
  const rowPrize = row.listed_prize_usd_cents == null ? 0 : Number(row.listed_prize_usd_cents);
  if (rowPrize !== p.listedPrizeUsdCents) return false;
  if (normGameKey(row.game_key) !== normGameKey(p.gameKey)) return false;
  return true;
}

/**
 * While the user is in the H2H queue (`searching`), listen for `INSERT` on `match_sessions` where they are
 * player A or B. Matches the row to current queue params so unrelated sessions do not flip UI.
 * Polling in `QueueScreen` remains a fallback if Realtime is unavailable.
 */
export function useH2hQueueMatchSignals(options: {
  enabled: boolean;
  userId: string;
  queueParamsRef: H2hQueueParamsRef;
}): void {
  const appliedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!options.enabled || options.userId === 'guest') return;

    const supabase = getSupabase();
    const uid = options.userId;

    const handleInsert = (payload: { new?: Record<string, unknown> }) => {
      const row = payload.new;
      if (!row?.id) return;

      const sessionId = String(row.id);
      if (appliedSessionIdRef.current === sessionId) return;

      const p = options.queueParamsRef.current;
      if (!p || !rowMatchesQueueParams(row, p)) return;

      const pa = row.player_a_id as string | undefined;
      const pb = row.player_b_id as string | undefined;
      if (!pa || !pb) return;
      const opponentId = pa === uid ? pb : pa;
      if (!opponentId || opponentId === uid) return;

      const st = useMatchmakingStore.getState();
      if (st.phase !== 'searching') return;

      appliedSessionIdRef.current = sessionId;

      void (async () => {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id,username,display_name,region')
          .eq('id', opponentId)
          .maybeSingle();
        const name = displayNameForProfile(prof?.username ?? null, prof?.display_name ?? null);
        const reg = prof?.region?.trim();
        useMatchmakingStore.getState().setFound(
          sessionId,
          {
            id: opponentId,
            username: name,
            rating: 1500,
            region: reg && reg.length > 0 ? reg : 'NA',
          },
          { serverSessionReady: true },
        );
      })();
    };

    const channel = supabase
      .channel(`h2h-queue:${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_sessions', filter: `player_a_id=eq.${uid}` },
        handleInsert,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_sessions', filter: `player_b_id=eq.${uid}` },
        handleInsert,
      )
      .subscribe();

    return () => {
      appliedSessionIdRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [options.enabled, options.userId, options.queueParamsRef]);
}
