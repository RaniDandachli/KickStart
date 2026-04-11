/**
 * After `claim_daily_prize_credits` returns claimed=true, the app invokes this with the user JWT.
 * Verifies the profile claimed today (UTC), respects push_notify_daily_credits, sends one Expo push
 * per UTC day (last_daily_credits_push_sent_ymd).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { sendExpoPushMessages } from '../_shared/expoPush.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

function utcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!jwt) return errorResponse('Unauthorized', 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return json({ ok: false, error: 'server_misconfigured' }, 503);

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData.user) return errorResponse('Unauthorized', 401);
  const userId = userData.user.id;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = utcYmd();

  const { data: row, error: selErr } = await admin
    .from('profiles')
    .select(
      'expo_push_token, last_daily_claim_ymd, push_notify_daily_credits, last_daily_credits_push_sent_ymd',
    )
    .eq('id', userId)
    .maybeSingle();

  if (selErr) {
    console.error('[notifyDailyCreditsPush] select', selErr.message);
    return json({ ok: false, error: 'lookup_failed' }, 500);
  }
  if (!row) return json({ ok: false, error: 'no_profile' }, 404);

  const token = typeof row.expo_push_token === 'string' ? row.expo_push_token.trim() : '';
  if (!token) return json({ ok: true, skipped: true, reason: 'no_token' });

  if (row.push_notify_daily_credits !== true) {
    return json({ ok: true, skipped: true, reason: 'opted_out' });
  }

  if (row.last_daily_claim_ymd !== today) {
    return json({ ok: false, error: 'not_claimed_today' }, 400);
  }

  if (row.last_daily_credits_push_sent_ymd === today) {
    return json({ ok: true, skipped: true, reason: 'already_sent' });
  }

  const push = await sendExpoPushMessages([
    {
      to: token,
      title: '100 Arcade Credits added',
      body: 'They are in your wallet. Open Arcade and play head-to-head or minigames.',
      data: { href: '/(app)/(tabs)/play' },
    },
  ]);

  if (!push.ok) {
    console.error('[notifyDailyCreditsPush] expo', push.error);
    return json({ ok: false, error: 'push_failed' }, 502);
  }

  const { error: upErr } = await admin
    .from('profiles')
    .update({ last_daily_credits_push_sent_ymd: today })
    .eq('id', userId);

  if (upErr) console.error('[notifyDailyCreditsPush] stamp', upErr.message);

  return json({ ok: true });
});
