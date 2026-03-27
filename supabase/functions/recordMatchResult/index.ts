import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  match_session_id: z.string().uuid().optional(),
  tournament_match_id: z.string().uuid().optional(),
  winner_user_id: z.string().uuid(),
  loser_user_id: z.string().uuid(),
  score: z.object({ a: z.number(), b: z.number() }),
  was_ranked: z.boolean().default(false),
  ranked_rating_delta: z.record(z.unknown()).optional(),
}).refine((b) => !!b.match_session_id !== !!b.tournament_match_id, {
  message: 'Exactly one of match_session_id or tournament_match_id required',
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

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const admin = createClient(supabaseUrl, serviceKey);

    // TODO: verify both players participated; anti-cheat flags; provisional handling.
    const { error } = await admin.from('match_results').insert({
      match_session_id: parsed.data.match_session_id ?? null,
      tournament_match_id: parsed.data.tournament_match_id ?? null,
      winner_user_id: parsed.data.winner_user_id,
      loser_user_id: parsed.data.loser_user_id,
      score: parsed.data.score,
      was_ranked: parsed.data.was_ranked,
      ranked_rating_delta: parsed.data.ranked_rating_delta ?? null,
      audit_ref: `auth:${userData.user.id}`,
    });
    if (error) return errorResponse(error.message, 500);

    return json({ ok: true });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
