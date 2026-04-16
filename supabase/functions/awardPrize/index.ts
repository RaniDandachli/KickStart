import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  tournament_id: z.string().uuid(),
  user_id: z.string().uuid(),
  description: z.string().min(3),
  /** Cash wallet (cents) — withdrawable pool when payouts exist. */
  wallet_cents: z.number().int().min(0).default(0),
  /** Arcade-only redeemable credits. */
  prize_credits: z.number().int().min(0).default(0),
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

    const { data, error } = await userClient.rpc('admin_award_tournament_prize', {
      p_tournament_id: parsed.data.tournament_id,
      p_target_user_id: parsed.data.user_id,
      p_wallet_cents: parsed.data.wallet_cents,
      p_prize_credits: parsed.data.prize_credits,
      p_gems: parsed.data.gems,
      p_description: parsed.data.description,
    });
    if (error) return errorResponse(error.message, 400);

    const row = data as { ok?: boolean; error?: string };
    if (row?.ok === false) return errorResponse(row.error ?? 'Award failed', 400);

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
