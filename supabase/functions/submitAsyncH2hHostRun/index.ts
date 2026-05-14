import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const SKILL_GAME_KEYS = [
  'tap-dash',
  'tile-clash',
  'ball-run',
  'dash-duel',
  'turbo-arena',
  'neon-dance',
  'neon-grid',
  'neon-ship',
  'shape-dash',
  'cyber-road',
] as const;

const GAME_KEY_TO_TYPE: Record<(typeof SKILL_GAME_KEYS)[number], string> = {
  'tap-dash': 'tap_dash',
  'tile-clash': 'tile_clash',
  'ball-run': 'ball_run',
  'dash-duel': 'dash_duel',
  'turbo-arena': 'turbo_arena',
  'neon-dance': 'neon_dance',
  'neon-grid': 'neon_grid',
  'neon-ship': 'neon_ship',
  'shape-dash': 'shape_dash',
  'cyber-road': 'cyber_road',
};

const Body = z.object({
  mode: z.enum(['casual', 'ranked', 'custom']),
  game_key: z.enum(SKILL_GAME_KEYS),
  entry_fee_wallet_cents: z.number().int().min(0),
  listed_prize_usd_cents: z.number().int().min(0),
  host_score: z.number().int().min(0).max(1_000_000),
  host_game_type: z.string().min(1).max(64),
  duration_ms: z.number().int().min(0).max(86_400_000),
  taps: z.number().int().min(0).max(2_000_000),
});

/** Supabase dashboard often only shows lifecycle lines unless we write to console. */
function logRpcErr(reqId: string, err: { message: string; code?: string; details?: string; hint?: string }) {
  console.error(
    `[submitAsyncH2hHostRun ${reqId}] rpc error:`,
    JSON.stringify({
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
    }),
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const reqId = crypto.randomUUID();
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl?.trim() || !anonKey?.trim()) {
      console.error(`[submitAsyncH2hHostRun ${reqId}] missing SUPABASE_URL or SUPABASE_ANON_KEY`);
      return errorResponse('Server configuration error', 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      console.error(`[submitAsyncH2hHostRun ${reqId}] auth:`, userErr?.message ?? 'no user');
      return errorResponse('Unauthorized', 401);
    }

    let rawJson: unknown;
    try {
      rawJson = await req.json();
    } catch {
      console.error(`[submitAsyncH2hHostRun ${reqId}] invalid JSON body`);
      return errorResponse('Invalid JSON body', 400);
    }

    const parsed = Body.safeParse(rawJson);
    if (!parsed.success) {
      console.error(`[submitAsyncH2hHostRun ${reqId}] zod:`, parsed.error.flatten());
      return errorResponse(parsed.error.message, 422);
    }

    const p = parsed.data;
    const expectedGt = GAME_KEY_TO_TYPE[p.game_key];
    if (!expectedGt || p.host_game_type !== expectedGt) {
      console.error(
        `[submitAsyncH2hHostRun ${reqId}] game_type_mismatch game_key=${p.game_key} host_game_type=${p.host_game_type} expected=${expectedGt}`,
      );
      return errorResponse('game_type_mismatch', 422);
    }

    console.log(
      `[submitAsyncH2hHostRun ${reqId}] calling h2h_async_host_submit user=${userData.user.id} game=${p.game_key} entry_cents=${p.entry_fee_wallet_cents}`,
    );

    const { data, error } = await userClient.rpc('h2h_async_host_submit', {
      p_mode: p.mode,
      p_game_key: p.game_key,
      p_entry_fee_wallet_cents: p.entry_fee_wallet_cents,
      p_listed_prize_usd_cents: p.listed_prize_usd_cents,
      p_host_score: p.host_score,
      p_host_game_type: p.host_game_type,
      p_duration_ms: p.duration_ms,
      p_taps: p.taps,
    });

    if (error) {
      logRpcErr(reqId, error);
      return errorResponse(error.message, 500);
    }
    const j = data as Record<string, unknown>;
    if (j?.ok !== true) {
      console.error(`[submitAsyncH2hHostRun ${reqId}] rpc returned ok=false:`, JSON.stringify(data));
      return errorResponse(String(j?.error ?? 'async_submit_failed'), 422);
    }
    console.log(`[submitAsyncH2hHostRun ${reqId}] ok`);
    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[submitAsyncH2hHostRun ${reqId}] unhandled:`, msg, e);
    return errorResponse(msg, 500);
  }
});
