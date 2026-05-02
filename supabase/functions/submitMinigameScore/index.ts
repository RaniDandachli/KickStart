import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const TAP_DASH_SPAWN_MS = 1500;

/** Mirrors `lib/ticketPayouts.ts` — server-authoritative for prize runs. */
const TAP_DASH_POINTS_PER_TICKET = 1;
const TILE_CLASH_POINTS_PER_TICKET = 50;
const BALL_RUN_POINTS_PER_TICKET = 25;
const NEON_POOL_POINTS_PER_TICKET = 200;
const DASH_DUEL_POINTS_PER_TICKET = 120;
const TURBO_ARENA_POINTS_PER_TICKET = 3;
const NEON_DANCE_POINTS_PER_TICKET = 8;
const NEON_GRID_POINTS_PER_TICKET = 18;
const NEON_SHIP_POINTS_PER_TICKET = 22;
const STACKER_JACKPOT_TICKETS = 10_000;
/** Matches `minigames/stacker/stackerConstants.ts` STACKER_WIN_ROWS */
const STACKER_WIN_ROWS = 26;
const DEFAULT_PRIZE_RUN_ENTRY_CREDITS = 10;
const STACKER_PRIZE_RUN_ENTRY_CREDITS = 20;
const TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS = 20;

function prizeRunEntryAndTickets(gameType: string, score: number): { entry: number; tickets: number } {
  switch (gameType) {
    case 'tap_dash':
      return {
        entry: DEFAULT_PRIZE_RUN_ENTRY_CREDITS,
        tickets: Math.max(0, Math.floor(score / TAP_DASH_POINTS_PER_TICKET)),
      };
    case 'tile_clash':
      return {
        entry: DEFAULT_PRIZE_RUN_ENTRY_CREDITS,
        tickets: Math.max(0, Math.floor(score / TILE_CLASH_POINTS_PER_TICKET)),
      };
    case 'ball_run':
      return {
        entry: DEFAULT_PRIZE_RUN_ENTRY_CREDITS,
        tickets: Math.max(0, Math.floor(score / BALL_RUN_POINTS_PER_TICKET)),
      };
    case 'neon_pool':
      return {
        entry: DEFAULT_PRIZE_RUN_ENTRY_CREDITS,
        tickets: Math.max(0, Math.floor(score / NEON_POOL_POINTS_PER_TICKET)),
      };
    case 'stacker':
      return {
        entry: STACKER_PRIZE_RUN_ENTRY_CREDITS,
        tickets: score >= STACKER_WIN_ROWS ? STACKER_JACKPOT_TICKETS : 0,
      };
    case 'dash_duel':
      return {
        entry: DEFAULT_PRIZE_RUN_ENTRY_CREDITS,
        tickets: Math.max(0, Math.floor(score / DASH_DUEL_POINTS_PER_TICKET)),
      };
    case 'turbo_arena':
      return {
        entry: TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS,
        tickets: Math.max(0, Math.floor(score / TURBO_ARENA_POINTS_PER_TICKET)),
      };
    case 'neon_dance':
      return {
        entry: DEFAULT_PRIZE_RUN_ENTRY_CREDITS,
        tickets: Math.max(0, Math.floor(score / NEON_DANCE_POINTS_PER_TICKET)),
      };
    case 'neon_grid':
      return {
        entry: DEFAULT_PRIZE_RUN_ENTRY_CREDITS,
        tickets: Math.max(0, Math.floor(score / NEON_GRID_POINTS_PER_TICKET)),
      };
    case 'neon_ship':
      return {
        entry: DEFAULT_PRIZE_RUN_ENTRY_CREDITS,
        tickets: Math.max(0, Math.floor(score / NEON_SHIP_POINTS_PER_TICKET)),
      };
    default:
      return { entry: DEFAULT_PRIZE_RUN_ENTRY_CREDITS, tickets: 0 };
  }
}

const Body = z.discriminatedUnion('game_type', [
  z.object({
    game_type: z.literal('tap_dash'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
    /** Ties this run to an H2H `match_sessions` row (must match `game_key`). */
    match_session_id: z.string().uuid().optional(),
  }),
  z.object({
    game_type: z.literal('tile_clash'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
    tap_intervals_ms: z.array(z.number().int().min(0).max(60_000)).max(8000),
    match_session_id: z.string().uuid().optional(),
  }),
  z.object({
    game_type: z.literal('ball_run'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
    match_session_id: z.string().uuid().optional(),
  }),
  z.object({
    game_type: z.literal('neon_pool'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
  }),
  z.object({
    game_type: z.literal('stacker'),
    score: z.number().int().min(0).max(64),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(500),
  }),
  z.object({
    game_type: z.literal('dash_duel'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
    match_session_id: z.string().uuid().optional(),
  }),
  z.object({
    game_type: z.literal('turbo_arena'),
    score: z.number().int().min(0).max(200),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(8_000),
    match_session_id: z.string().uuid().optional(),
  }),
  z.object({
    game_type: z.literal('neon_dance'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
    match_session_id: z.string().uuid().optional(),
    /** Run It Arcade / H2H tie-break metadata (optional). */
    rings_passed: z.number().int().min(0).max(1_000_000).optional(),
    best_streak: z.number().int().min(0).max(1_000_000).optional(),
    progression: z.number().min(0).max(1e12).optional(),
    survival_time_sec: z.number().min(0).max(3_600).optional(),
    winner_ready: z.boolean().optional(),
  }),
  z.object({
    game_type: z.literal('neon_grid'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
    match_session_id: z.string().uuid().optional(),
  }),
  z.object({
    game_type: z.literal('neon_ship'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
    match_session_id: z.string().uuid().optional(),
  }),
  z.object({
    game_type: z.literal('shape_dash'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
    match_session_id: z.string().uuid().optional(),
  }),
  z.object({
    game_type: z.literal('cyber_road'),
    score: z.number().int().min(0).max(1_000_000),
    duration_ms: z.number().int().min(0).max(3_600_000),
    taps: z.number().int().min(0).max(2_000_000),
    match_session_id: z.string().uuid().optional(),
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

/** Stacker: score = rows stacked; max ~16–32 typical. */
function maxPlausibleStackerScore(durationMs: number): number {
  return Math.min(64, Math.floor(durationMs / 400 + 24));
}

/** Dash Duel: score = floor(scroll * DIST_SCALE); scroll ~ RUN_SPEED * time. */
function maxPlausibleDashDuelScore(durationMs: number): number {
  return Math.min(1_000_000, Math.floor(durationMs * 0.08) + 2000);
}

/** Turbo Arena: goals in a short match; generous vs clock. */
function maxPlausibleTurboArenaGoals(durationMs: number): number {
  return Math.min(200, Math.floor(durationMs / 1800) + 24);
}

/** Neon Dance — score scales with streaks, rings, and survival. */
function maxPlausibleNeonDanceScore(durationMs: number): number {
  return Math.min(1_000_000, Math.floor(durationMs * 2.4) + 25_000);
}

/** Neon Grid — rows cleared; generous cap vs session length. */
function maxPlausibleNeonGridScore(durationMs: number): number {
  return Math.min(1_000_000, Math.floor(durationMs / 80) + 800);
}

/** Void Glider — score = floor(scroll / 8); scroll ~ FORWARD_PX_S * time. */
function maxPlausibleNeonShipScore(durationMs: number): number {
  return Math.min(1_000_000, Math.floor(durationMs * 0.04) + 4000);
}

/** Shape Dash Marathon — score ≈ horizontal distance px; generous vs session length / speed ramps. */
function maxPlausibleShapeDashMarathonScore(durationMs: number): number {
  return Math.min(1_000_000, Math.floor(durationMs * 0.72) + 120_000);
}

/** Cyber Road — score = rows forward (floor(z) − offset); generous vs session length. */
function maxPlausibleCyberRoadScore(durationMs: number): number {
  return Math.min(1_000_000, Math.floor(durationMs / 70) + 900);
}

/** `minigame_scores.game_type` → `match_sessions.game_key` slug for H2H validation. */
const H2H_GAME_KEY_FOR_TYPE: Partial<Record<string, string>> = {
  tap_dash: 'tap-dash',
  tile_clash: 'tile-clash',
  ball_run: 'ball-run',
  dash_duel: 'dash-duel',
  turbo_arena: 'turbo-arena',
  neon_dance: 'neon-dance',
  neon_grid: 'neon-grid',
  neon_ship: 'neon-ship',
  shape_dash: 'shape-dash',
  cyber_road: 'cyber-road',
};

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

function toInt(n: unknown, fallback = 0): number {
  if (typeof n === 'number' && Number.isFinite(n)) return Math.trunc(n);
  if (typeof n === 'string' && n.trim() !== '' && Number.isFinite(Number(n))) return Math.trunc(Number(n));
  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl?.trim() || !serviceKey?.trim() || !anonKey?.trim()) {
      console.error('[submitMinigameScore] Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY');
      return errorResponse('Server configuration error', 500);
    }

    const authHeader =
      req.headers.get('Authorization')?.trim() ||
      req.headers.get('authorization')?.trim() ||
      '';
    if (!authHeader || !/^Bearer\s+\S+/.test(authHeader)) {
      return errorResponse('Unauthorized: missing Authorization bearer token', 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      if (userErr) console.warn('[submitMinigameScore] getUser', userErr.message);
      return errorResponse('Unauthorized', 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count, error: rateErr } = await admin
      .from('minigame_scores')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userData.user.id)
      .gte('created_at', since);
    if (rateErr) {
      console.error('[submitMinigameScore] rate query', rateErr.message, rateErr);
      return errorResponse(rateErr.message, 500);
    }
    if ((count ?? 0) > 45) {
      return errorResponse('Too many score submissions. Wait a minute and try again.', 429);
    }

    let rawJson: unknown;
    try {
      rawJson = await req.json();
    } catch (e) {
      console.error('[submitMinigameScore] Invalid JSON body', e);
      return errorResponse('Invalid JSON body', 400);
    }

    const prizeRun = typeof rawJson === 'object' && rawJson !== null && (rawJson as { prize_run?: unknown }).prize_run === true;
    const prizeReservationRaw =
      typeof rawJson === 'object' && rawJson !== null
        ? (rawJson as { prize_run_reservation_id?: unknown }).prize_run_reservation_id
        : undefined;
    const prizeReservationId =
      typeof prizeReservationRaw === 'string' ? prizeReservationRaw.trim() : '';

    const parsed = Body.safeParse(rawJson);
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const data = parsed.data;
    const score = toInt(data.score);
    const duration_ms = Math.max(0, toInt(data.duration_ms));
    const taps = Math.max(0, toInt(data.taps));

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
    } else if (data.game_type === 'neon_pool') {
      if (score > maxPlausibleNeonPoolScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
      const maxShots = Math.floor(duration_ms / 400) + 400;
      if (taps > maxShots) return errorResponse('Invalid shot count for duration', 422);
    } else if (data.game_type === 'stacker') {
      if (score > maxPlausibleStackerScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
      if (taps > score + 4) return errorResponse('Invalid taps for stacker score', 422);
    } else if (data.game_type === 'dash_duel') {
      if (score > maxPlausibleDashDuelScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
      const maxJumps = Math.floor(duration_ms / 50) + 500;
      if (taps > maxJumps) return errorResponse('Invalid jump count for duration', 422);
    } else if (data.game_type === 'turbo_arena') {
      if (score > maxPlausibleTurboArenaGoals(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
    } else if (data.game_type === 'neon_dance') {
      if (score > maxPlausibleNeonDanceScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
      const maxJumps = Math.floor(duration_ms / 28) + 6000;
      if (taps > maxJumps) return errorResponse('Invalid taps for neon dance session', 422);
    } else if (data.game_type === 'neon_grid') {
      if (score > maxPlausibleNeonGridScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
      const maxMoves = Math.floor(duration_ms / 40) + 2000;
      if (taps > maxMoves) return errorResponse('Invalid move count for session duration', 422);
    } else if (data.game_type === 'neon_ship') {
      if (score > maxPlausibleNeonShipScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
      const maxThrusts = Math.floor(duration_ms / 12) + 4000;
      if (taps > maxThrusts) return errorResponse('Invalid thrust count for session duration', 422);
    } else if (data.game_type === 'shape_dash') {
      if (score > maxPlausibleShapeDashMarathonScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
      const maxJumps = Math.floor(duration_ms / 35) + 8000;
      if (taps > maxJumps) return errorResponse('Invalid input count for session duration', 422);
    } else if (data.game_type === 'cyber_road') {
      if (score > maxPlausibleCyberRoadScore(duration_ms)) {
        return errorResponse('Score impossible for session duration', 422);
      }
      const maxMoves = Math.floor(duration_ms / 45) + 4000;
      if (taps > maxMoves) return errorResponse('Invalid move count for session duration', 422);
    } else {
      return errorResponse('Unsupported game_type', 422);
    }

    let matchSessionId: string | undefined;
    const rawMid = 'match_session_id' in data ? data.match_session_id : undefined;
    if (rawMid) {
      const expectedGk = H2H_GAME_KEY_FOR_TYPE[data.game_type];
      if (!expectedGk) {
        return errorResponse('match_session_id is not valid for this game_type', 422);
      }
      matchSessionId = rawMid;
      const { data: ms, error: msErr } = await admin
        .from('match_sessions')
        .select('id,status,player_a_id,player_b_id,game_key')
        .eq('id', matchSessionId)
        .single();
      if (msErr || !ms) return errorResponse('Match session not found', 404);
      const pa = ms.player_a_id as string | null;
      const pb = ms.player_b_id as string | null;
      if (!pa || !pb) return errorResponse('Match session missing players', 400);
      const uid = userData.user.id;
      if (uid !== pa && uid !== pb) return errorResponse('Not a participant', 403);
      const st = ms.status as string;
      if (st !== 'lobby' && st !== 'in_progress') {
        return errorResponse('Match is not open for score submission', 400);
      }
      const gk = String(ms.game_key ?? '').trim().toLowerCase();
      const okGk = expectedGk === 'tap-dash' ? (gk === '' || gk === 'tap-dash') : gk === expectedGk;
      if (!okGk) {
        return errorResponse('This match session is not for this minigame', 400);
      }
    }

    if (prizeRun) {
      if (matchSessionId) {
        return errorResponse('prize_run cannot be combined with match_session_id', 422);
      }
      const gt = data.game_type;
      const supportedPrize = new Set([
        'tap_dash',
        'tile_clash',
        'ball_run',
        'neon_pool',
        'stacker',
        'dash_duel',
        'turbo_arena',
        'neon_dance',
        'neon_grid',
        'neon_ship',
      ]);
      if (!supportedPrize.has(gt)) {
        return errorResponse('prize_run is not supported for this game_type', 422);
      }
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(prizeReservationId)) {
        return errorResponse(
          'prize_run_reservation_id required — prize credits are charged when the run starts; restart the run from the arcade.',
          422,
        );
      }

      const { tickets: ticketsGranted } = prizeRunEntryAndTickets(gt, score);
      const { data: rpcData, error: rpcErr } = await admin.rpc('complete_minigame_prize_run', {
        p_reservation_id: prizeReservationId,
        p_user_id: userData.user.id,
        p_game_type: gt,
        p_score: score,
        p_duration_ms: duration_ms,
        p_taps: taps,
        p_tickets_granted: ticketsGranted,
      });
      if (rpcErr) {
        console.error('[submitMinigameScore] complete_minigame_prize_run', rpcErr.message, rpcErr);
        return errorResponse(rpcErr.message, 500);
      }
      const row = rpcData as { ok?: boolean; error?: string; prize_credits?: number; redeem_tickets?: number; tickets_granted?: number };
      if (!row?.ok) {
        const err = row?.error ?? '';
        if (err === 'invalid_or_consumed_reservation' || err === 'reservation_game_mismatch') {
          return errorResponse(
            'This prize run is no longer valid. If you already submitted, refresh your profile; otherwise start a new run.',
            409,
          );
        }
        return errorResponse(row?.error ?? 'Prize run failed', 400);
      }
      return json({
        ok: true,
        prize_run: true,
        prize_credits: row.prize_credits,
        redeem_tickets: row.redeem_tickets,
        tickets_granted: row.tickets_granted ?? ticketsGranted,
      });
    }

    const insertRow: Record<string, unknown> = {
      user_id: userData.user.id,
      game_type: data.game_type,
      score,
      duration_ms,
      taps,
    };
    if (matchSessionId) insertRow.match_session_id = matchSessionId;

    const { error } = await admin.from('minigame_scores').insert(insertRow);
    if (error) {
      const code = (error as { code?: string }).code;
      console.error('[submitMinigameScore] insert', code, error.message, insertRow);
      if (code === '23505') {
        return errorResponse('You already submitted a score for this match', 409);
      }
      if (code === '23503') {
        return errorResponse(
          'This match is no longer valid for score upload. Re-enter the queue or apply DB migration 00024 (match_session_id on minigame_scores).',
          400,
        );
      }
      if (code === '42703') {
        return errorResponse(
          'Database is missing minigame score columns (run migration 00024_minigame_h2h_scores).',
          503,
        );
      }
      return errorResponse(error.message, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('[submitMinigameScore] unhandled', e);
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
