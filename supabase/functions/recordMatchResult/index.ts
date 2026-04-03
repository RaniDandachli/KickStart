import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Score = z.object({ a: z.number(), b: z.number() });

const Body = z
  .object({
    match_session_id: z.string().uuid().optional(),
    tournament_match_id: z.string().uuid().optional(),
    /** When true, winner/loser must be omitted and scores may tie. */
    is_draw: z.boolean().optional(),
    winner_user_id: z.string().uuid().optional().nullable(),
    loser_user_id: z.string().uuid().optional().nullable(),
    score: Score,
    was_ranked: z.boolean().default(false),
    ranked_rating_delta: z.record(z.unknown()).optional(),
  })
  .superRefine((b, ctx) => {
    const hasSession = !!b.match_session_id;
    const hasTournament = !!b.tournament_match_id;
    if (hasSession === hasTournament) {
      ctx.addIssue({
        code: 'custom',
        message: 'Exactly one of match_session_id or tournament_match_id required',
      });
    }
    if (hasTournament) {
      if (b.is_draw) {
        ctx.addIssue({ code: 'custom', message: 'Tournament matches cannot be draws in this endpoint' });
      }
      if (!b.winner_user_id || !b.loser_user_id) {
        ctx.addIssue({ code: 'custom', message: 'Tournament match requires winner_user_id and loser_user_id' });
      }
    }
    if (hasSession && b.is_draw) {
      if (b.winner_user_id != null || b.loser_user_id != null) {
        ctx.addIssue({ code: 'custom', message: 'Draw must omit winner and loser' });
      }
    }
    if (hasSession && !b.is_draw) {
      if (!b.winner_user_id || !b.loser_user_id) {
        ctx.addIssue({ code: 'custom', message: 'Non-draw requires winner_user_id and loser_user_id' });
      }
    }
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
    const uid = userData.user.id;
    const p = parsed.data;

    if (p.match_session_id) {
      const { data: sess, error: sErr } = await admin
        .from('match_sessions')
        .select(
          'id,status,player_a_id,player_b_id',
        )
        .eq('id', p.match_session_id)
        .single();

      if (sErr || !sess) return errorResponse('Match session not found', 404);
      if (sess.status === 'completed') {
        return json({ ok: true, idempotent: true });
      }

      const pa = sess.player_a_id as string | null;
      const pb = sess.player_b_id as string | null;
      if (!pa || !pb) return errorResponse('Match session missing players', 400);
      if (uid !== pa && uid !== pb) return errorResponse('Not a participant', 403);

      if (!p.is_draw) {
        const w = p.winner_user_id!;
        const l = p.loser_user_id!;
        if (![pa, pb].includes(w) || ![pa, pb].includes(l) || w === l) {
          return errorResponse('Winner/loser must be the two participants', 400);
        }
      }

      const scoreA = p.score.a;
      const scoreB = p.score.b;

      const { data: existing } = await admin
        .from('match_results')
        .select('id')
        .eq('match_session_id', p.match_session_id)
        .maybeSingle();
      if (existing) return json({ ok: true, idempotent: true });

      const { error: upErr } = await admin
        .from('match_sessions')
        .update({
          status: 'completed',
          winner_user_id: p.is_draw ? null : p.winner_user_id,
          score_a: scoreA,
          score_b: scoreB,
          ended_at: new Date().toISOString(),
          verification_status: 'verified',
        })
        .eq('id', p.match_session_id)
        .neq('status', 'completed');

      if (upErr) return errorResponse(upErr.message, 500);

      const { error: insErr } = await admin.from('match_results').insert({
        match_session_id: p.match_session_id,
        tournament_match_id: null,
        winner_user_id: p.is_draw ? null : p.winner_user_id,
        loser_user_id: p.is_draw ? null : p.loser_user_id,
        score: p.score,
        was_ranked: p.was_ranked,
        ranked_rating_delta: p.ranked_rating_delta ?? null,
        audit_ref: `auth:${uid}`,
      });
      if (insErr) {
        if (insErr.code === '23505') return json({ ok: true, idempotent: true });
        return errorResponse(insErr.message, 500);
      }

      return json({ ok: true });
    }

    // Tournament branch: insert only (bracket updates handled elsewhere later)
    if (!p.winner_user_id || !p.loser_user_id) return errorResponse('Invalid tournament payload', 422);

    const { error } = await admin.from('match_results').insert({
      match_session_id: null,
      tournament_match_id: p.tournament_match_id,
      winner_user_id: p.winner_user_id,
      loser_user_id: p.loser_user_id,
      score: p.score,
      was_ranked: p.was_ranked,
      ranked_rating_delta: p.ranked_rating_delta ?? null,
      audit_ref: `auth:${uid}`,
    });
    if (error) return errorResponse(error.message, 500);

    return json({ ok: true });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
