/**
 * Scans `h2h_queue_entries` (waiting) and notifies users whose `h2h_open_slot_watch` prefs match.
 * Invoke on a schedule with the same secret as `h2hMaintenance` (header `x-h2h-maintenance-secret`).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { sendExpoPushMessages } from '../_shared/expoPush.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

type WatchJson = {
  enabled?: boolean;
  entryCents?: number[];
  gameKeys?: string[] | null;
};

function watchMatchesRow(
  row: { game_key: string | null; entry_fee_wallet_cents: number | null },
  raw: unknown,
): boolean {
  const w = raw as WatchJson;
  if (!w || w.enabled !== true) return false;
  const ec = Math.max(0, Math.floor(Number(row.entry_fee_wallet_cents ?? 0)));
  const tiers = Array.isArray(w.entryCents) ? w.entryCents.map((x) => Math.floor(Number(x))) : [];
  if (tiers.length > 0 && !tiers.includes(ec)) return false;
  const gk = (row.game_key ?? '').trim();
  const games = w.gameKeys;
  if (games != null && games.length > 0) {
    if (!gk || !games.includes(gk)) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const expected = Deno.env.get('H2H_MAINTENANCE_SECRET');
  const sent = req.headers.get('x-h2h-maintenance-secret');
  if (!expected || sent !== expected) {
    return errorResponse('Unauthorized', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: waiters, error: wErr } = await admin
    .from('h2h_queue_entries')
    .select('id,user_id,game_key,entry_fee_wallet_cents,mode')
    .eq('status', 'waiting');

  if (wErr) return errorResponse(wErr.message, 500);
  const rows = waiters ?? [];
  if (rows.length === 0) return json({ ok: true, notified: 0, skipped: 'no_waiters' });

  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id,expo_push_token,push_notify_h2h_open_slots,h2h_open_slot_watch')
    .eq('push_notify_h2h_open_slots', true);

  if (pErr) return errorResponse(pErr.message, 500);

  let notified = 0;
  const messages: { to: string; title: string; body: string; data?: Record<string, unknown> }[] = [];
  const logRows: { watcher_user_id: string; queue_entry_id: string }[] = [];

  for (const q of rows) {
    const waiterId = q.user_id as string;
    const qid = q.id as string;
    const gk = (q.game_key as string | null)?.trim() ?? '';
    const ec = Math.max(0, Math.floor(Number(q.entry_fee_wallet_cents ?? 0)));
    const feeUsd = (ec / 100).toFixed(2);

    for (const p of profiles ?? []) {
      const uid = p.id as string;
      if (uid === waiterId) continue;
      const token = typeof p.expo_push_token === 'string' ? p.expo_push_token.trim() : '';
      if (!token) continue;
      if (!watchMatchesRow({ game_key: gk || null, entry_fee_wallet_cents: ec }, p.h2h_open_slot_watch)) continue;

      const { data: existing } = await admin
        .from('h2h_open_slot_notify_log')
        .select('id')
        .eq('watcher_user_id', uid)
        .eq('queue_entry_id', qid)
        .maybeSingle();
      if (existing) continue;

      messages.push({
        to: token,
        title: 'Open match available',
        body: gk
          ? `Someone is in queue — $${feeUsd} · ${gk.replace(/-/g, ' ')}. Open Live matches to join.`
          : `Someone is in queue — $${feeUsd}. Open Live matches to join.`,
        data: { href: '/(app)/(tabs)/play/live-matches' },
      });
      logRows.push({ watcher_user_id: uid, queue_entry_id: qid });
    }
  }

  if (messages.length === 0) {
    return json({ ok: true, notified: 0, candidates: rows.length });
  }

  const push = await sendExpoPushMessages(messages, { allowPartial: true });
  if (!push.ok) {
    console.error('[h2hOpenMatchWatchScan] expo', push.error);
    return json({ ok: false, error: push.error }, 502);
  }

  for (const row of logRows) {
    const { error: insErr } = await admin.from('h2h_open_slot_notify_log').insert(row);
    if (insErr) console.warn('[h2hOpenMatchWatchScan] log', insErr.message);
    else notified += 1;
  }

  return json({ ok: true, notified, queueRows: rows.length });
});
