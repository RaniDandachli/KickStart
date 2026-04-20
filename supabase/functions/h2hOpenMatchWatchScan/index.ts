/**
 * Scans `h2h_queue_entries` (waiting) and notifies users whose `h2h_open_slot_watch` prefs match.
 * Sends **Expo push** (native) and **Web Push** (browser subscriptions) when configured.
 * Invoked from `h2hMaintenance` cron or POST manually with `x-h2h-maintenance-secret`.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { sendExpoPushMessages } from '../_shared/expoPush.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';
import { sendWebPushToSubscription, type WebPushSubscriptionRow } from '../_shared/webPushSend.ts';

type WatchJson = {
  enabled?: boolean;
  entryCents?: number[];
  gameKeys?: string[] | null;
};

function titleCaseGameSlug(gk: string): string {
  return gk
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

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

type Eligible = {
  uid: string;
  qid: string;
  title: string;
  body: string;
  hrefPath: string;
};

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

  const publicOrigin = (Deno.env.get('WEB_PUSH_PUBLIC_ORIGIN')?.trim() || 'https://runitarcade.app').replace(/\/$/, '');
  const openMatchPath = Deno.env.get('WEB_PUSH_OPEN_MATCH_PATH')?.trim() || '/play/live-matches';
  const openMatchUrl = openMatchPath.startsWith('http')
    ? openMatchPath
    : `${publicOrigin}${openMatchPath.startsWith('/') ? '' : '/'}${openMatchPath}`;

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

  const eligible: Eligible[] = [];

  for (const q of rows) {
    const waiterId = q.user_id as string;
    const qid = q.id as string;
    const gk = (q.game_key as string | null)?.trim() ?? '';
    const ec = Math.max(0, Math.floor(Number(q.entry_fee_wallet_cents ?? 0)));
    const feeUsd = (ec / 100).toFixed(2);

    for (const p of profiles ?? []) {
      const uid = p.id as string;
      if (uid === waiterId) continue;
      if (!watchMatchesRow({ game_key: gk || null, entry_fee_wallet_cents: ec }, p.h2h_open_slot_watch)) continue;

      const { data: existing } = await admin
        .from('h2h_open_slot_notify_log')
        .select('id')
        .eq('watcher_user_id', uid)
        .eq('queue_entry_id', qid)
        .maybeSingle();
      if (existing) continue;

      const gameLabel = gk ? titleCaseGameSlug(gk) : 'Live matches';
      eligible.push({
        uid,
        qid,
        title: 'A spot opened that fits your alerts',
        body: gk
          ? `${gameLabel} · $${feeUsd} entry — jump in from Live matches while it's still open.`
          : `$${feeUsd} entry is up — open Live matches and grab it before someone else does.`,
        hrefPath: '/(app)/(tabs)/play/live-matches',
      });
    }
  }

  if (eligible.length === 0) {
    return json({ ok: true, notified: 0, candidates: rows.length });
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const expoMessages: { to: string; title: string; body: string; data?: Record<string, unknown> }[] = [];
  /** Pairs where we queued an Expo message (user had a token), mirroring legacy “notify attempt” semantics. */
  const expoQueuedKeys = new Set<string>();

  for (const e of eligible) {
    const token = typeof profileMap.get(e.uid)?.expo_push_token === 'string'
      ? String(profileMap.get(e.uid)!.expo_push_token).trim()
      : '';
    if (!token) continue;
    expoMessages.push({
      to: token,
      title: e.title,
      body: e.body,
      data: { href: e.hrefPath },
    });
    expoQueuedKeys.add(`${e.uid}:${e.qid}`);
  }

  const uids = [...new Set(eligible.map((e) => e.uid))];
  const { data: allSubs, error: sErr } = await admin
    .from('web_push_subscriptions')
    .select('user_id,endpoint,p256dh,auth')
    .in('user_id', uids);

  if (sErr) console.warn('[h2hOpenMatchWatchScan] web_push_subscriptions', sErr.message);

  const subsByUser = new Map<string, WebPushSubscriptionRow[]>();
  for (const s of allSubs ?? []) {
    const uid = s.user_id as string;
    const row: WebPushSubscriptionRow = {
      endpoint: s.endpoint as string,
      p256dh: s.p256dh as string,
      auth: s.auth as string,
    };
    const list = subsByUser.get(uid) ?? [];
    list.push(row);
    subsByUser.set(uid, list);
  }

  const webSentKeys = new Set<string>();

  for (const e of eligible) {
    const subs = subsByUser.get(e.uid) ?? [];
    for (const sub of subs) {
      const r = await sendWebPushToSubscription(sub, {
        title: e.title,
        body: e.body,
        url: openMatchUrl,
      });
      if (r.ok) webSentKeys.add(`${e.uid}:${e.qid}`);
      if (!r.ok && r.statusCode === 410) {
        await admin.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }

  let expoOk = true;
  let expoErr: string | undefined;
  if (expoMessages.length > 0) {
    const push = await sendExpoPushMessages(expoMessages, { allowPartial: true });
    if (!push.ok) {
      expoOk = false;
      expoErr = push.error;
      console.error('[h2hOpenMatchWatchScan] expo', push.error);
    }
  }

  async function insertLogsForKeys(keys: Set<string>): Promise<number> {
    let n = 0;
    for (const e of eligible) {
      const key = `${e.uid}:${e.qid}`;
      if (!keys.has(key)) continue;
      const { error: insErr } = await admin.from('h2h_open_slot_notify_log').insert({
        watcher_user_id: e.uid,
        queue_entry_id: e.qid,
      });
      if (insErr) console.warn('[h2hOpenMatchWatchScan] log', insErr.message);
      else n += 1;
    }
    return n;
  }

  const logKeys = new Set<string>();
  for (const e of eligible) {
    const key = `${e.uid}:${e.qid}`;
    if (webSentKeys.has(key)) logKeys.add(key);
    if (expoOk && expoQueuedKeys.has(key)) logKeys.add(key);
  }
  const notified = await insertLogsForKeys(logKeys);

  if (!expoOk) {
    return json(
      {
        ok: false,
        error: expoErr,
        notified,
        queueRows: rows.length,
        eligible: eligible.length,
        expoPushes: expoMessages.length,
        webPushesAttempted: (allSubs ?? []).length,
        note: 'Expo push failed; web pushes and matching log rows may still have been written.',
      },
      502,
    );
  }

  return json({
    ok: true,
    notified,
    queueRows: rows.length,
    eligible: eligible.length,
    expoPushes: expoMessages.length,
    webPushesAttempted: (allSubs ?? []).length,
  });
});
