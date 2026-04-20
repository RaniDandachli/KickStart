import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

/**
 * Scheduled cleanup: stale H2H lobbies + queue waiters (see migration 00023).
 * Set secret `H2H_MAINTENANCE_SECRET` in Supabase → Edge Functions → Secrets.
 *
 * **Schedule:** use pg_cron + pg_net (see `supabase/scripts/schedule-h2h-maintenance.example.sql`)
 * or any cron that can POST with **apikey + Authorization Bearer + x-h2h-maintenance-secret**.
 * Open-match pushes run only after this function runs and successfully invokes `h2hOpenMatchWatchScan`.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    console.info('[h2hMaintenance] POST', new Date().toISOString());

    const expected = Deno.env.get('H2H_MAINTENANCE_SECRET');
    const sent = req.headers.get('x-h2h-maintenance-secret');
    if (!expected) {
      console.error('[h2hMaintenance] missing H2H_MAINTENANCE_SECRET in Edge Function secrets');
      return errorResponse('Unauthorized', 401);
    }
    if (sent !== expected) {
      console.warn('[h2hMaintenance] invalid x-h2h-maintenance-secret');
      return errorResponse('Unauthorized', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data, error } = await admin.rpc('h2h_maintenance_expire_stale');
    if (error) return errorResponse(error.message, 500);

    /** Notify watchers when queue rows are waiting (`h2hOpenMatchWatchScan` — same secret). */
    try {
      const scanUrl = `${supabaseUrl}/functions/v1/h2hOpenMatchWatchScan`;
      const scanRes = await fetch(scanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'x-h2h-maintenance-secret': expected,
        },
      });
      const scanText = await scanRes.text();
      if (!scanRes.ok) {
        console.warn('[h2hMaintenance] h2hOpenMatchWatchScan non-OK', scanRes.status, scanText.slice(0, 400));
      } else {
        console.info('[h2hMaintenance] h2hOpenMatchWatchScan OK', scanRes.status, scanText.slice(0, 400));
      }
    } catch (e) {
      console.warn('[h2hMaintenance] h2hOpenMatchWatchScan invoke failed', e);
    }

    return json(data ?? { ok: false, error: 'no_payload' });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
