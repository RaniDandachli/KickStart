import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  name: z.string().min(3),
  format: z.enum(['single_elimination', 'round_robin']),
  entry_type: z.enum(['free', 'credits', 'sponsor']),
  entry_cost_credits: z.number().int().min(0).default(0),
  prize_description: z.string().min(1),
  max_players: z.number().int().min(2).max(256),
  season_id: z.string().uuid().optional(),
});

type Ok = { ok: true; tournament_id: string };

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

    const payload = parsed.data;
    const { data, error } = await admin
      .from('tournaments')
      .insert({
        name: payload.name,
        format: payload.format,
        entry_type: payload.entry_type,
        entry_cost_credits: payload.entry_cost_credits,
        prize_description: payload.prize_description,
        max_players: payload.max_players,
        season_id: payload.season_id ?? null,
        creator_id: userData.user.id,
        state: 'draft',
      })
      .select('id')
      .single();

    if (error) return errorResponse(error.message, 500);

    await admin.from('admin_audit_logs').insert({
      actor_id: userData.user.id,
      action: 'create_tournament',
      entity_type: 'tournament',
      entity_id: data.id,
      payload,
    });

    return json({ ok: true, tournament_id: data.id } satisfies Ok);
    // TODO: transition draft→open via moderation workflow; notify followers.
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return errorResponse(msg, 500);
  }
});
