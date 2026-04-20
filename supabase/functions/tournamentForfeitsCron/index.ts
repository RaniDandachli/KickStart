/**
 * Placeholder for automated tournament no-show forfeits.
 *
 * Production flow (you implement):
 * 1. Add check-in / ready flags or rely on `tournament_matches.scheduled_at` + match_sessions.
 * 2. Schedule this function via Supabase cron or external worker every few minutes.
 * 3. For each `tournament_matches` row with status in ('pending','ready'), scheduled_at + interval '30 minutes' < now(),
 *    advance the opponent (set winner_id, status 'completed', propagate to next_match_id).
 *
 * Requires service role. Keep `verify_jwt = false` and protect with a secret header (same pattern as h2hMaintenance).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    const secret = Deno.env.get('H2H_MAINTENANCE_SECRET')?.trim();
    const hdr = req.headers.get('x-h2h-maintenance-secret')?.trim();
    if (!secret || hdr !== secret) {
      return errorResponse('Unauthorized', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data, error } = await admin
      .from('tournament_matches')
      .select('id,status,scheduled_at')
      .in('status', ['pending', 'ready'])
      .not('scheduled_at', 'is', null)
      .lt('scheduled_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(50);

    if (error) return errorResponse(error.message, 500);

    return json({
      ok: true,
      message:
        'Stub only — implement winner selection + bracket propagation before enabling cron. Rows that would be scanned:',
      candidate_count: data?.length ?? 0,
      sample: (data ?? []).slice(0, 5),
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
