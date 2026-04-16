import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  tournament_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return errorResponse('Unauthorized', 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const { data, error } = await userClient.rpc('join_tournament', {
      p_tournament_id: parsed.data.tournament_id,
    });
    if (error) return errorResponse(error.message, 400);

    const row = data as { ok?: boolean; error?: string; current_player_count?: number; state?: string };
    if (row?.ok === false) {
      const code =
        row.error === 'insufficient_wallet'
          ? 402
          : row.error === 'tournament_full' || row.error === 'tournament_not_joinable'
            ? 409
            : 400;
      return errorResponse(row.error ?? 'Could not join tournament', code);
    }

    return json({
      ok: true,
      current_player_count: row?.current_player_count,
      state: row?.state,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return errorResponse(msg, 500);
  }
});
