/**
 * Builds single-elimination bracket rows: `tournament_rounds` + `tournament_matches`.
 * Admin/moderator only. Idempotent replace for legacy (single pod) tournaments.
 * For `unlimited_entrants` tournaments, appends a new pod without deleting prior pods.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  tournament_id: z.string().uuid(),
  /** Optional explicit seed order (must match the batch of entrants exactly when set). */
  seed_user_ids: z.array(z.string().uuid()).optional(),
});

function roundLabel(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - roundIndex;
  if (fromEnd <= 1) return 'Finals';
  if (fromEnd === 2) return 'Semifinals';
  if (fromEnd === 3) return 'Quarterfinals';
  return `Round ${roundIndex + 1}`;
}

function padToPowerOfTwo(ids: string[]): (string | null)[] {
  const n = ids.length;
  const size = 2 ** Math.ceil(Math.log2(Math.max(n, 2)));
  const out: (string | null)[] = [...ids];
  while (out.length < size) out.push(null);
  return out;
}

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

    const tournamentId = parsed.data.tournament_id;

    const { data: tournament, error: tErr } = await admin.from('tournaments').select('*').eq('id', tournamentId).maybeSingle();
    if (tErr || !tournament) return errorResponse('Tournament not found', 404);
    if (tournament.format !== 'single_elimination') {
      return errorResponse('Only single_elimination is supported for bracket generation', 422);
    }

    const unlimited = Boolean((tournament as { unlimited_entrants?: boolean }).unlimited_entrants);
    const podSize = Math.max(
      2,
      (tournament as { bracket_pod_size?: number | null }).bracket_pod_size ??
        (tournament as { max_players?: number }).max_players ??
        8,
    );

    let nextPod = 1;
    let orderedIds: string[] = [];

    if (!unlimited) {
      const { error: delM } = await admin.from('tournament_matches').delete().eq('tournament_id', tournamentId);
      if (delM) return errorResponse(delM.message, 500);
      const { error: delR } = await admin.from('tournament_rounds').delete().eq('tournament_id', tournamentId);
      if (delR) return errorResponse(delR.message, 500);

      await admin
        .from('tournament_entries')
        .update({ bracket_pod_index: null })
        .eq('tournament_id', tournamentId);

      const { data: entries, error: eErr } = await admin
        .from('tournament_entries')
        .select('user_id, joined_at')
        .eq('tournament_id', tournamentId)
        .eq('status', 'registered')
        .order('joined_at', { ascending: true });
      if (eErr) return errorResponse(eErr.message, 500);
      orderedIds = (entries ?? []).map((r: { user_id: string }) => r.user_id as string);
      if (orderedIds.length < 2) {
        return errorResponse('Need at least 2 registered players to generate a bracket', 422);
      }
      nextPod = 1;
    } else {
      const { data: maxRow } = await admin
        .from('tournament_rounds')
        .select('bracket_pod_index')
        .eq('tournament_id', tournamentId)
        .order('bracket_pod_index', { ascending: false })
        .limit(1)
        .maybeSingle();
      nextPod = ((maxRow as { bracket_pod_index?: number } | null)?.bracket_pod_index ?? 0) + 1;

      const { data: batch, error: bErr } = await admin
        .from('tournament_entries')
        .select('user_id, joined_at')
        .eq('tournament_id', tournamentId)
        .eq('status', 'registered')
        .is('bracket_pod_index', null)
        .order('joined_at', { ascending: true })
        .limit(podSize);
      if (bErr) return errorResponse(bErr.message, 500);
      orderedIds = (batch ?? []).map((r: { user_id: string }) => r.user_id as string);
      if (orderedIds.length < 2) {
        return errorResponse(
          `Need at least 2 registered players not yet placed in a bracket (next wave up to ${podSize})`,
          422,
        );
      }
    }

    const seeds = parsed.data.seed_user_ids;
    if (seeds && seeds.length > 0) {
      if (seeds.length !== orderedIds.length) return errorResponse('seed_user_ids must include every entrant in this batch', 422);
      const setE = new Set(orderedIds);
      for (const s of seeds) {
        if (!setE.has(s)) return errorResponse('seed_user_ids must match tournament entrants in this batch', 422);
      }
      orderedIds = [...seeds];
    }

    const slots = padToPowerOfTwo(orderedIds);
    const size = slots.length;
    const numRounds = Math.round(Math.log2(size));

    const roundRows: { id: string; tournament_id: string; bracket_pod_index: number; round_index: number; label: string }[] =
      [];
    for (let r = 0; r < numRounds; r++) {
      roundRows.push({
        id: crypto.randomUUID(),
        tournament_id: tournamentId,
        bracket_pod_index: nextPod,
        round_index: r,
        label: roundLabel(r, numRounds),
      });
    }

    const { error: insR } = await admin.from('tournament_rounds').insert(roundRows);
    if (insR) return errorResponse(insR.message, 500);

    const roundIdByIndex = new Map<number, string>();
    for (const rr of roundRows) roundIdByIndex.set(rr.round_index, rr.id);

    const matchIds: string[][] = [];
    for (let r = 0; r < numRounds; r++) {
      const n = size / 2 ** (r + 1);
      matchIds[r] = Array.from({ length: n }, () => crypto.randomUUID());
    }

    const now = new Date().toISOString();
    const matchRows: Record<string, unknown>[] = [];

    for (let r = numRounds - 1; r >= 0; r--) {
      const rid = roundIdByIndex.get(r)!;
      for (let i = 0; i < matchIds[r].length; i++) {
        const mid = matchIds[r][i];
        const nextId = r < numRounds - 1 ? matchIds[r + 1][Math.floor(i / 2)]! : null;

        let playerA: string | null = null;
        let playerB: string | null = null;
        let winnerId: string | null = null;
        let status = 'pending';

        if (r === 0) {
          playerA = slots[2 * i] ?? null;
          playerB = slots[2 * i + 1] ?? null;
          if (playerA && !playerB) {
            winnerId = playerA;
            status = 'completed';
          } else if (!playerA && playerB) {
            winnerId = playerB;
            status = 'completed';
          } else if (!playerA && !playerB) {
            status = 'void';
          }
        }

        matchRows.push({
          id: mid,
          tournament_id: tournamentId,
          bracket_pod_index: nextPod,
          round_id: rid,
          match_index: i,
          player_a_id: playerA,
          player_b_id: playerB,
          winner_id: winnerId,
          next_match_id: nextId,
          status,
          updated_at: now,
        });
      }
    }

    const { error: insM } = await admin.from('tournament_matches').insert(matchRows);
    if (insM) return errorResponse(insM.message, 500);

    const participantIds = [...new Set(orderedIds)];
    const { error: upErr } = await admin
      .from('tournament_entries')
      .update({ bracket_pod_index: nextPod })
      .eq('tournament_id', tournamentId)
      .in('user_id', participantIds);
    if (upErr) return errorResponse(upErr.message, 500);

    return json({
      ok: true,
      tournament_id: tournamentId,
      bracket_pod_index: nextPod,
      unlimited_entrants: unlimited,
      rounds_created: numRounds,
      matches_created: matchRows.length,
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
