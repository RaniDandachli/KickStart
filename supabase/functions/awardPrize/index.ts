import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  tournament_id: z.string().uuid(),
  user_id: z.string().uuid(),
  description: z.string().min(3),
  credits: z.number().int().min(0).default(0),
  gems: z.number().int().min(0).default(0),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return errorResponse('Unauthorized', 401);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
    if (profile?.role !== 'admin') return errorResponse('Forbidden', 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    // TODO: transactional grant + ledger rows + optional cosmetic assignment — no cash payouts.
    await admin.from('admin_audit_logs').insert({
      actor_id: userData.user.id,
      action: 'award_prize',
      entity_type: 'tournament',
      entity_id: parsed.data.tournament_id,
      payload: parsed.data,
    });

    return json({ ok: true });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
