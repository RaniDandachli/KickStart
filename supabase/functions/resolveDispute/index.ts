import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  match_session_id: z.string().uuid(),
  resolution: z.enum(['uphold', 'reverse', 'void']),
  notes: z.string().optional(),
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
    if (profile?.role !== 'admin' && profile?.role !== 'moderator') return errorResponse('Forbidden', 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    // TODO: update `match_sessions` dispute + recompute standings; write audit log + notifications.
    await admin.from('admin_audit_logs').insert({
      actor_id: userData.user.id,
      action: 'resolve_dispute',
      entity_type: 'match_session',
      entity_id: parsed.data.match_session_id,
      payload: parsed.data,
    });

    return json({ ok: true });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
