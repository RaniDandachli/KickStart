import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({ tournament_id: z.string().uuid() });

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

    const { data: t, error: tErr } = await admin
      .from('tournaments')
      .select('id, state, current_player_count')
      .eq('id', parsed.data.tournament_id)
      .maybeSingle();
    if (tErr || !t) return errorResponse('Tournament not found', 404);

    if (t.state !== 'open' && t.state !== 'full') {
      return errorResponse('Tournament is not accepting a lock from this state', 409);
    }
    if ((t.current_player_count ?? 0) < 2) {
      return errorResponse('Need at least 2 registered players to lock', 422);
    }

    const { error: upErr } = await admin
      .from('tournaments')
      .update({ state: 'locked', updated_at: new Date().toISOString() })
      .eq('id', parsed.data.tournament_id);
    if (upErr) return errorResponse(upErr.message, 500);

    return json({ ok: true });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
