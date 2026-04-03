import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  mode: z.enum(['casual', 'ranked', 'custom']),
  opponent_user_id: z.string().uuid(),
  game_key: z.string().max(64).optional(),
  entry_fee_wallet_cents: z.number().int().min(0).optional(),
  listed_prize_usd_cents: z.number().int().min(0).optional(),
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

    const selfId = userData.user.id;
    if (parsed.data.opponent_user_id === selfId) return errorResponse('Opponent cannot be yourself', 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: oppRow, error: oppErr } = await admin
      .from('profiles')
      .select('id')
      .eq('id', parsed.data.opponent_user_id)
      .maybeSingle();
    if (oppErr) return errorResponse(oppErr.message, 500);
    if (!oppRow) return errorResponse('Opponent profile not found', 404);

    const { data: row, error: insErr } = await admin
      .from('match_sessions')
      .insert({
        mode: parsed.data.mode,
        status: 'lobby',
        player_a_id: selfId,
        player_b_id: parsed.data.opponent_user_id,
        game_key: parsed.data.game_key ?? null,
        entry_fee_wallet_cents: parsed.data.entry_fee_wallet_cents ?? 0,
        listed_prize_usd_cents: parsed.data.listed_prize_usd_cents ?? null,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insErr) return errorResponse(insErr.message, 500);

    return json({ ok: true, match_session_id: row.id });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
