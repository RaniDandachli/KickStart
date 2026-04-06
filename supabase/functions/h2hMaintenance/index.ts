import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

/**
 * Scheduled cleanup: stale H2H lobbies + queue waiters (see migration 00023).
 * Set secret `H2H_MAINTENANCE_SECRET` in Supabase → Edge Functions → Secrets.
 * Schedule: Dashboard → Edge Functions → h2hMaintenance → Cron (e.g. every 15 minutes).
 * Invoke with header: `x-h2h-maintenance-secret: <same value>`
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const expected = Deno.env.get('H2H_MAINTENANCE_SECRET');
    const sent = req.headers.get('x-h2h-maintenance-secret');
    if (!expected || sent !== expected) {
      return errorResponse('Unauthorized', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data, error } = await admin.rpc('h2h_maintenance_expire_stale');
    if (error) return errorResponse(error.message, 500);

    return json(data ?? { ok: false, error: 'no_payload' });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
