/**
 * Broadcast "Tournament of the Day" to opted-in users with an Expo push token.
 * Schedule in Supabase Dashboard → Edge Functions → Cron (e.g. daily 14:00 UTC):
 *   POST /functions/v1/broadcastTournamentOfDayPush
 *   Header: Authorization: Bearer <PUSH_CRON_SECRET>
 *   (or x-push-cron-secret: same value)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { sendExpoPushMessages } from '../_shared/expoPush.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

function utcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function verifyCron(req: Request): boolean {
  const secret = Deno.env.get('PUSH_CRON_SECRET')?.trim();
  if (!secret) return false;
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (bearer === secret) return true;
  return (req.headers.get('x-push-cron-secret') ?? '').trim() === secret;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  if (!verifyCron(req)) return json({ ok: false, error: 'unauthorized' }, 401);

  const adminUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return json({ ok: false, error: 'server_misconfigured' }, 503);

  const admin = createClient(adminUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = utcYmd();

  const { data: rows, error } = await admin
    .from('profiles')
    .select('id, expo_push_token')
    .not('expo_push_token', 'is', null)
    .eq('push_notify_tournament_of_day', true)
    .or(`last_tournament_of_day_push_sent_ymd.is.null,last_tournament_of_day_push_sent_ymd.neq.${today}`);

  if (error) {
    console.error('[broadcastTournamentOfDayPush] select', error.message);
    return json({ ok: false, error: 'lookup_failed' }, 500);
  }

  const list = (rows ?? []) as { id: string; expo_push_token: string | null }[];
  const messages = list
    .filter((r) => r.expo_push_token && r.expo_push_token.trim().length > 0)
    .map((r) => ({
      to: r.expo_push_token!.trim(),
      title: 'Tournament of the Day is live',
      body: 'Free to enter — jump in now and chase the top of the board.',
      data: { href: '/(app)/(tabs)/tournaments/daily-free' } as Record<string, unknown>,
    }));

  if (messages.length === 0) {
    return json({ ok: true, recipients: 0 });
  }

  const BATCH = 80;
  for (let i = 0; i < messages.length; i += BATCH) {
    const chunk = messages.slice(i, i + BATCH);
    const sendResult = await sendExpoPushMessages(chunk, { allowPartial: true });
    if (!sendResult.ok) {
      console.error('[broadcastTournamentOfDayPush] expo batch', i, sendResult.error);
      return json({ ok: false, error: 'push_failed', at_batch: i }, 502);
    }
  }

  const ids = list.filter((r) => r.expo_push_token?.trim()).map((r) => r.id);
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error: upErr } = await admin
      .from('profiles')
      .update({ last_tournament_of_day_push_sent_ymd: today })
      .in('id', slice);
    if (upErr) console.error('[broadcastTournamentOfDayPush] stamp', upErr.message);
  }

  return json({ ok: true, recipients: messages.length });
});
