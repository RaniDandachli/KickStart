/**
 * Save or remove the browser Web Push subscription for the signed-in user.
 * POST body: { subscription: { endpoint, keys: { p256dh, auth } } } to upsert,
 * or { deleteEndpoint: "<url>" } to remove one row.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const SubscriptionBody = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(16),
      auth: z.string().min(8),
    }),
  }),
});

const DeleteBody = z.object({
  deleteEndpoint: z.string().url(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return errorResponse('Unauthorized', 401);
  const uid = userData.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const del = DeleteBody.safeParse(body);
  if (del.success) {
    const { error } = await userClient
      .from('web_push_subscriptions')
      .delete()
      .eq('user_id', uid)
      .eq('endpoint', del.data.deleteEndpoint);
    if (error) return errorResponse(error.message, 500);
    return json({ ok: true, deleted: true });
  }

  const parsed = SubscriptionBody.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.message, 422);

  const { endpoint, keys } = parsed.data.subscription;
  const row = {
    user_id: uid,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    updated_at: new Date().toISOString(),
  };

  const { error } = await userClient.from('web_push_subscriptions').upsert(row, {
    onConflict: 'endpoint',
  });
  if (error) return errorResponse(error.message, 500);
  return json({ ok: true });
});
