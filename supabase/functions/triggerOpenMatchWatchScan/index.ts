/**
 * Authenticated trigger for `h2hOpenMatchWatchScan` — called from the app when the user enters the
 * waiting queue so watchers get notified without relying on DB webhooks/cron.
 * Keeps `H2H_MAINTENANCE_SECRET` server-side only.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!jwt) {
    console.warn('[triggerOpenMatchWatchScan] missing bearer token');
    return errorResponse('Unauthorized: missing bearer token', 401);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const maintenance = Deno.env.get('H2H_MAINTENANCE_SECRET');
  if (!serviceKey || !maintenance) {
    console.error('[triggerOpenMatchWatchScan] missing SERVICE_ROLE_KEY or H2H_MAINTENANCE_SECRET');
    return errorResponse('Server misconfigured', 503);
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData.user) {
    console.warn('[triggerOpenMatchWatchScan] invalid bearer token', authErr?.message ?? 'no_user');
    return errorResponse('Unauthorized: invalid user token', 401);
  }

  console.info('[triggerOpenMatchWatchScan] invoke', userData.user.id);

  const scanUrl = `${url}/functions/v1/h2hOpenMatchWatchScan`;
  const scanRes = await fetch(scanUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'x-h2h-maintenance-secret': maintenance,
    },
  });

  const scanText = await scanRes.text();
  let scanJson: unknown = null;
  try {
    scanJson = scanText ? JSON.parse(scanText) : null;
  } catch {
    scanJson = { raw: scanText.slice(0, 500) };
  }

  if (!scanRes.ok) {
    console.warn('[triggerOpenMatchWatchScan] scan non-OK', scanRes.status, scanText.slice(0, 300));
    return errorResponse(typeof scanJson === 'object' && scanJson != null && 'error' in scanJson
      ? String((scanJson as { error?: string }).error)
      : scanText.slice(0, 200), scanRes.status);
  }

  return json({ ok: true, scan: scanJson });
});
