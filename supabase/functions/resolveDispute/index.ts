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

    const mid = parsed.data.match_session_id;
    const { data: session, error: sErr } = await admin
      .from('match_sessions')
      .select(
        'id,status,player_a_id,player_b_id,winner_user_id,score_a,score_b,dispute_status,verification_status,evidence_notes',
      )
      .eq('id', mid)
      .maybeSingle();
    if (sErr || !session) return errorResponse('Match session not found', 404);

    const { data: settlement } = await admin
      .from('h2h_contest_economy_settlements')
      .select('id')
      .eq('match_session_id', mid)
      .maybeSingle();

    if (settlement && parsed.data.resolution === 'reverse') {
      return errorResponse(
        'Prize settlement already recorded for this match — reverse the result in the dashboard or issue manual wallet adjustments.',
        409,
      );
    }

    const noteLine = parsed.data.notes?.trim()
      ? `\n[moderator ${new Date().toISOString()}] ${parsed.data.notes.trim()}`
      : '';
    const evidence = [session.evidence_notes ?? '', noteLine].filter(Boolean).join('').trim() || null;

    if (parsed.data.resolution === 'uphold') {
      const { error: uErr } = await admin
        .from('match_sessions')
        .update({
          dispute_status: 'resolved',
          verification_status: 'verified',
          evidence_notes: evidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mid);
      if (uErr) return errorResponse(uErr.message, 500);
    } else if (parsed.data.resolution === 'void') {
      const { error: uErr } = await admin
        .from('match_sessions')
        .update({
          status: 'cancelled',
          dispute_status: 'resolved',
          verification_status: 'rejected',
          evidence_notes: evidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mid);
      if (uErr) return errorResponse(uErr.message, 500);
    } else {
      const wa = session.winner_user_id as string | null;
      const pa = session.player_a_id as string | null;
      const pb = session.player_b_id as string | null;
      const sa = Number(session.score_a ?? 0);
      const sb = Number(session.score_b ?? 0);
      if (!pa || !pb) {
        return errorResponse('Cannot reverse — missing players on session', 422);
      }
      let newWinner: string | null = wa;
      if (wa === pa) newWinner = pb;
      else if (wa === pb) newWinner = pa;
      else {
        newWinner = sa >= sb ? pb : pa;
      }

      const { error: uErr } = await admin
        .from('match_sessions')
        .update({
          winner_user_id: newWinner,
          score_a: sb,
          score_b: sa,
          dispute_status: 'resolved',
          verification_status: 'verified',
          evidence_notes: evidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mid);
      if (uErr) return errorResponse(uErr.message, 500);

      const { data: mr } = await admin
        .from('match_results')
        .select('id, winner_user_id, loser_user_id')
        .eq('match_session_id', mid)
        .maybeSingle();
      if (mr) {
        const nw = newWinner!;
        const nl = nw === pa ? pb : pa;
        const { error: mrErr } = await admin
          .from('match_results')
          .update({
            winner_user_id: nw,
            loser_user_id: nl,
            score: { a: sb, b: sa },
          })
          .eq('id', mr.id as string);
        if (mrErr) console.warn('[resolveDispute] match_results update', mrErr.message);
        else if ((mr.winner_user_id as string | null) && nw && mr.winner_user_id !== nw) {
          console.warn('[resolveDispute] Winner changed — reconcile user_stats if needed:', mid);
        }
      }
    }

    await admin.from('admin_audit_logs').insert({
      actor_id: userData.user.id,
      action: 'resolve_dispute',
      entity_type: 'match_session',
      entity_id: mid,
      payload: parsed.data,
    });

    return json({ ok: true });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
