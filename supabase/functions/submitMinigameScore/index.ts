import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const TAP_DASH_SPAWN_MS = 1500;

const Body = z.discriminatedUnion('game_type', [
  z.object({
    game_type: z.literal('tap_dash'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
  }),
  z.object({
    game_type: z.literal('tile_clash'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
    tap_intervals_ms: z.array(z.number().int().min(0).max(60_000)).max(8000),
  }),
  z.object({
    game_type: z.literal('ball_run'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
  }),
  z.object({
    game_type: z.literal('neon_pool'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
  }),
]);

/** Max pipes that can exist / be passed given spawn cadence (generous margin). */
function maxPlausibleTapDashScore(durationMs: number): number {
  if (durationMs < TAP_DASH_SPAWN_MS) return 0;
  const spawned = 1 + Math.floor((durationMs - TAP_DASH_SPAWN_MS) / TAP_DASH_SPAWN_MS);
  return spawned + 2;
}

/** Ball Run score ~ ∫ speed dt; generous cap vs session length. */
function maxPlausibleBallRunScore(durationMs: number): number {
  return Math.floor(durationMs / 6 + 8000);
}

/** Pool score ~ balls + bonuses; ~25 per 10s session + cap */
function maxPlausibleNeonPoolScore(durationMs: number): number {
  return Math.floor(durationMs / 8 + 12000);
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Reject bot-like constant cadence and impossible scores. */
function validateTileClash(
  score: number,
  durationMs: number,
  taps: number,
  intervals: number[],
): string | null {
  if (taps > 0 && intervals.length !== taps - 1) return 'Tap intervals mismatch';
  if (taps === 0 && score > 0) return 'Invalid score';

  if (intervals.length >= 60 && stdev(intervals) < 0.9) {
    return 'Unnatural tap regularity';
  }
  if (intervals.length >= 24 && median(intervals) < 26) {
    return 'Tap timing too fast';
  }

  if (score > taps * 35 + 400) return 'Score impossible for tap count';
  if (score > durationMs / 12 + 800) return 'Score impossible for session length';

  return null;
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

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const data = parsed.data;
    const { score, duration_ms, taps } = data;

    const maxTaps = Math.floor(duration_ms / 50) + 120;
    if (taps > maxTaps) return errorResponse('Invalid taps for duration', 422);

    if (data.game_type === 'tap_dash') {
      if (score > maxPlausibleTapDashScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
    } else if (data.game_type === 'tile_clash') {
      const err = validateTileClash(score, duration_ms, taps, data.tap_intervals_ms);
      if (err) return errorResponse(err, 422);
    } else if (data.game_type === 'ball_run') {
      if (score > maxPlausibleBallRunScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
      const maxLanes = Math.floor(duration_ms / 40) + 400;
      if (taps > maxLanes) return errorResponse('Invalid lane changes for duration', 422);
    } else {
      if (score > maxPlausibleNeonPoolScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
      const maxShots = Math.floor(duration_ms / 400) + 400;
      if (taps > maxShots) return errorResponse('Invalid shot count for duration', 422);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { error } = await admin.from('minigame_scores').insert({
      user_id: userData.user.id,
      game_type: data.game_type,
      score,
      duration_ms,
      taps,
    });
    if (error) return errorResponse(error.message, 500);

    return json({ ok: true });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
