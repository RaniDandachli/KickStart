/**
 * Sends a welcome email via Resend when a new profile row is created (signup).
 * Trigger: Supabase Dashboard → Database → Webhooks → INSERT on public.profiles
 *   URL: https://<project>.supabase.co/functions/v1/sendWelcomeEmail
 *   HTTP Header: Authorization: Bearer <WELCOME_EMAIL_WEBHOOK_SECRET>
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';
import { sendWelcomeEmailViaResend } from '../_shared/welcomeEmail.ts';

const WebhookBody = z.object({
  type: z.string(),
  table: z.string().optional(),
  schema: z.string().optional(),
  record: z
    .object({
      id: z.string().uuid(),
      username: z.string().optional(),
    })
    .passthrough(),
});

/** Prefer SUPPORT_EMAIL; else support@<sending-domain> from RESEND_FROM_EMAIL */
function deriveSupportEmail(fromHeader: string, configured: string | undefined): string {
  const c = configured?.trim();
  if (c) return c;
  const m = fromHeader.match(/<([^>]+)>/);
  const addr = (m?.[1] ?? fromHeader).trim();
  const at = addr.lastIndexOf('@');
  if (at > 0 && at < addr.length - 1) {
    const domain = addr.slice(at + 1).trim();
    if (domain && !/[\s<>]/.test(domain)) return `support@${domain}`;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return addr;
  console.error('[sendWelcomeEmail] Set SUPPORT_EMAIL secret; could not parse domain from FROM.');
  return addr;
}

function verifyWebhookSecret(req: Request): boolean {
  const expected = Deno.env.get('WELCOME_EMAIL_WEBHOOK_SECRET')?.trim();
  if (!expected) return false;
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token === expected) return true;
  const alt = req.headers.get('x-webhook-secret')?.trim();
  return alt === expected;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    if (!Deno.env.get('WELCOME_EMAIL_WEBHOOK_SECRET')?.trim()) {
      console.error('[sendWelcomeEmail] Missing WELCOME_EMAIL_WEBHOOK_SECRET');
      return json({ ok: false, error: 'welcome_webhook_not_configured' }, 503);
    }
    if (!verifyWebhookSecret(req)) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? Deno.env.get('FROM_EMAIL');
    if (!resendKey || !fromEmail) {
      console.error('[sendWelcomeEmail] Missing RESEND_API_KEY or RESEND_FROM_EMAIL/FROM_EMAIL');
      return json({ ok: false, error: 'resend_not_configured' }, 503);
    }

    const raw = await req.json();
    const parsed = WebhookBody.safeParse(raw);
    if (!parsed.success) {
      return errorResponse('Invalid webhook payload', 422);
    }

    const { type, table, record } = parsed.data;
    if (type !== 'INSERT' || table !== 'profiles') {
      return json({ ok: true, skipped: true, reason: 'not_profiles_insert' });
    }

    const userId = record.id;
    const username = (record.username ?? 'player').trim() || 'player';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
    if (userErr) {
      console.error('[sendWelcomeEmail] admin.getUserById:', userErr.message);
      return json({ ok: false, error: 'user_lookup_failed' }, 502);
    }

    const email = userData.user?.email?.trim();
    if (!email) {
      return json({ ok: true, skipped: true, reason: 'no_email' });
    }

    const supportEmail = deriveSupportEmail(fromEmail, Deno.env.get('SUPPORT_EMAIL'));
    const brandName = Deno.env.get('BRAND_NAME')?.trim() || 'Run It Arcade';

    const sent = await sendWelcomeEmailViaResend(resendKey, fromEmail, email, {
      username,
      supportEmail,
      brandName,
    }, userId);

    if (!sent.ok) {
      console.error('[sendWelcomeEmail] Resend failed:', sent.error.slice(0, 500));
      return json({ ok: false, error: 'send_failed' }, 502);
    }

    console.log('[sendWelcomeEmail] sent for user', userId);
    return json({ ok: true });
  } catch (e) {
    console.error('[sendWelcomeEmail]', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'internal_error' }, 500);
  }
});
