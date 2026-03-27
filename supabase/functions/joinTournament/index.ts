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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return errorResponse('Unauthorized', 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const admin = createClient(supabaseUrl, serviceKey);
    const tId = parsed.data.tournament_id;

    const { data: t } = await admin.from('tournaments').select('*').eq('id', tId).single();
    if (!t) return errorResponse('Tournament not found', 404);
    if (t.state !== 'open' && t.state !== 'full') return errorResponse('Tournament locked', 409);

    if (t.entry_type === 'credits' && t.entry_cost_credits > 0) {
      const { data: prof } = await admin.from('profiles').select('credits').eq('id', userData.user.id).single();
      if (!prof || prof.credits < t.entry_cost_credits) return errorResponse('Insufficient credits', 402);
      // TODO: debit credits in transaction row via RPC for atomicity.
    }

    const { error: insErr } = await admin.from('tournament_entries').insert({
      tournament_id: tId,
      user_id: userData.user.id,
      status: 'registered',
    });
    if (insErr) return errorResponse(insErr.message, 409);

    // TODO: transactional RPC: increment `current_player_count`, auto `open`→`full`, ledger credit spend.

    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return errorResponse(msg, 500);
  }
});
