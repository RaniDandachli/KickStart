import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Score = z.object({ a: z.number(), b: z.number() });

type H2hEconomyPayload = {
  loss_consolation_credits?: number;
  prize_wallet_cents_added?: number;
};

async function h2hEconomyForUser(
  admin: ReturnType<typeof createClient>,
  matchSessionId: string,
  userId: string,
): Promise<H2hEconomyPayload> {
  const { data: row, error } = await admin
    .from('h2h_contest_economy_settlements')
    .select('winner_user_id,loser_user_id,prize_wallet_cents_granted,consolation_prize_credits_granted')
    .eq('match_session_id', matchSessionId)
    .maybeSingle();
  if (error || !row) return {};
  const w = row.winner_user_id as string;
  const l = row.loser_user_id as string;
  const pw = Number(row.prize_wallet_cents_granted ?? 0);
  const cc = Number(row.consolation_prize_credits_granted ?? 0);
  if (userId === w && pw > 0) return { prize_wallet_cents_added: pw };
  if (userId === l && cc > 0) return { loss_consolation_credits: cc };
  return {};
}

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
    /**
     * Caller forfeits (left match / confirmed forfeit). Skips minigame_scores verification.
     * Must equal authenticated user and match loser_user_id.
     */
    forfeit_declared_by: z.string().uuid().optional(),
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl?.trim() || !serviceKey?.trim() || !anonKey?.trim()) {
      console.error('[recordMatchResult] Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY');
      return errorResponse('Server configuration error', 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return errorResponse('Unauthorized', 401);

    let rawJson: unknown;
    try {
      rawJson = await req.json();
    } catch (e) {
      console.error('[recordMatchResult] Invalid JSON', e);
      return errorResponse('Invalid JSON body', 400);
    }

    const parsed = Body.safeParse(rawJson);
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const admin = createClient(supabaseUrl, serviceKey);
    const uid = userData.user.id;
    const p = parsed.data;

    if (p.match_session_id) {
      const { data: sess, error: sErr } = await admin
        .from('match_sessions')
        .select('id,status,player_a_id,player_b_id,game_key')
        .eq('id', p.match_session_id)
        .single();

      if (sErr || !sess) return errorResponse('Match session not found', 404);

      const pa = sess.player_a_id as string | null;
      const pb = sess.player_b_id as string | null;
      if (!pa || !pb) return errorResponse('Match session missing players', 400);
      if (uid !== pa && uid !== pb) return errorResponse('Not a participant', 403);

      if (sess.status !== 'lobby' && sess.status !== 'in_progress' && sess.status !== 'completed') {
        return errorResponse(`Match cannot accept results (status: ${sess.status})`, 400);
      }

      if (sess.status === 'completed') {
        const econ = await h2hEconomyForUser(admin, p.match_session_id, uid);
        return json({ ok: true, idempotent: true, ...econ });
      }

      if (!p.is_draw) {
        const w = p.winner_user_id!;
        const l = p.loser_user_id!;
        if (![pa, pb].includes(w) || ![pa, pb].includes(l) || w === l) {
          return errorResponse('Winner/loser must be the two participants', 400);
        }
      }

      const forfeitBy = p.forfeit_declared_by;
      if (forfeitBy) {
        if (p.is_draw) return errorResponse('Forfeit cannot be a draw', 400);
        if (forfeitBy !== uid) return errorResponse('Forfeit can only be declared by the forfeiting player', 403);
        if (p.loser_user_id !== forfeitBy) return errorResponse('Forfeit payload mismatch', 400);
        if (!p.winner_user_id || p.winner_user_id === forfeitBy) {
          return errorResponse('Forfeit requires a distinct winner', 400);
        }
      }

      const scoreA = Math.trunc(p.score.a);
      const scoreB = Math.trunc(p.score.b);

      const gk = String(sess.game_key ?? '').trim().toLowerCase();
      const skillGameType = ((): string | null => {
        if (gk === '' || gk === 'tap-dash') return 'tap_dash';
        if (gk === 'tile-clash') return 'tile_clash';
        if (gk === 'ball-run') return 'ball_run';
        if (gk === 'dash-duel') return 'dash_duel';
        if (gk === 'turbo-arena') return 'turbo_arena';
        if (gk === 'neon-dance') return 'neon_dance';
        if (gk === 'neon-grid') return 'neon_grid';
        if (gk === 'neon-ship') return 'neon_ship';
        return null;
      })();
      if (!forfeitBy && skillGameType) {
        const gt = skillGameType;
        const { data: rowA, error: eA } = await admin
          .from('minigame_scores')
          .select('score')
          .eq('match_session_id', p.match_session_id)
          .eq('user_id', pa)
          .eq('game_type', gt)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const { data: rowB, error: eB } = await admin
          .from('minigame_scores')
          .select('score')
          .eq('match_session_id', p.match_session_id)
          .eq('user_id', pb)
          .eq('game_type', gt)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (eA || eB) {
          console.error('[recordMatchResult] minigame_scores read', eA, eB);
          return errorResponse('Could not verify minigame scores', 500);
        }
        if (rowA == null || rowB == null) {
          return errorResponse(
            'Both players must submit validated skill-contest scores before this match can complete',
            400,
          );
        }
        const saDb = Math.trunc(Number(rowA.score));
        const sbDb = Math.trunc(Number(rowB.score));
        if (saDb !== scoreA || sbDb !== scoreB) {
          return errorResponse('Submitted result does not match validated scores on record', 400);
        }
      }

      const { data: existing } = await admin
        .from('match_results')
        .select('id')
        .eq('match_session_id', p.match_session_id)
        .maybeSingle();
      if (existing) {
        const econ = await h2hEconomyForUser(admin, p.match_session_id, uid);
        return json({ ok: true, idempotent: true, ...econ });
      }

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

      if (upErr) {
        console.error('[recordMatchResult] match_sessions update', upErr.message, upErr);
        return errorResponse(upErr.message, 500);
      }

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
        if (insErr.code === '23505') {
          const econ = await h2hEconomyForUser(admin, p.match_session_id, uid);
          return json({ ok: true, idempotent: true, ...econ });
        }
        console.error('[recordMatchResult] match_results insert', insErr.message, insErr);
        return errorResponse(insErr.message, 500);
      }

      const econ = await h2hEconomyForUser(admin, p.match_session_id, uid);
      return json({ ok: true, ...econ });
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
    if (error) {
      console.error('[recordMatchResult] tournament insert', error.message, error);
      return errorResponse(error.message, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('[recordMatchResult] unhandled', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
