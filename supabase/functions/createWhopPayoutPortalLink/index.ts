/**
 * Whop platforms — enroll connected account (Company) + hosted payouts portal link.
 * Secrets: WHOP_COMPANY_API_KEY (platform), WHOP_PARENT_COMPANY_ID (biz_… parent).
 *
 * Deploy: `npx supabase functions deploy createWhopPayoutPortalLink`
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';
import { whopAccountLinksCreate, whopCompaniesCreate } from '../_shared/whopRest.ts';

const Body = z.object({
  refreshUrl: z.string().min(8),
  returnUrl: z.string().min(8),
});

/** Whop rejects placeholder / disposable-style addresses for company creation. */
function emailLooksDeliverableForWhop(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  const at = e.lastIndexOf('@');
  const domain = e.slice(at + 1);
  if (!domain || domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  const blocked = new Set([
    'example.com',
    'example.org',
    'example.net',
    'test.com',
    'localhost',
  ]);
  if (blocked.has(domain)) return false;
  if (domain.endsWith('.invalid') || domain.endsWith('.local') || domain.endsWith('.localhost')) return false;
  if (domain.includes('phone.auth') || domain.includes('sms.') || domain.includes('fakeemail')) return false;
  return true;
}

const WHOP_EMAIL_HELP =
  'Whop needs a real mailbox (e.g. Gmail). Add or change the email on your RunitArcade account to one you use, confirm it if asked, then try again. Test or placeholder addresses are rejected.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const whopKey = Deno.env.get('WHOP_COMPANY_API_KEY')?.trim();
    const parentId = Deno.env.get('WHOP_PARENT_COMPANY_ID')?.trim();
    if (!whopKey || !parentId) {
      return errorResponse('Whop payouts are not configured (WHOP_COMPANY_API_KEY / WHOP_PARENT_COMPANY_ID)', 503);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader =
      req.headers.get('Authorization')?.trim() ||
      req.headers.get('authorization')?.trim() ||
      '';
    if (!authHeader || !/^Bearer\s+\S+/.test(authHeader)) {
      return errorResponse('Unauthorized: missing Authorization bearer token', 401);
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      if (userErr) console.warn('[createWhopPayoutPortalLink] getUser', userErr.message);
      return errorResponse('Unauthorized', 401);
    }

    const userId = userData.user.id;
    const email = userData.user.email?.trim();
    if (!email) {
      return errorResponse('Your account needs an email address to use Whop payouts.', 422);
    }
    if (!emailLooksDeliverableForWhop(email)) {
      return errorResponse(WHOP_EMAIL_HELP, 422);
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);
    const { refreshUrl, returnUrl } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('whop_company_id, display_name, username')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profile) return errorResponse('Profile not found', 404);

    let companyId = profile.whop_company_id as string | null;
    const display = (profile.display_name as string | null)?.trim();
    const username = ((profile.username as string) ?? 'player').trim();
    const title = (display || username).slice(0, 120) || 'RunitArcade player';

    if (!companyId) {
      let created: { id: string };
      try {
        created = await whopCompaniesCreate(whopKey, {
          title,
          email,
          parent_company_id: parentId,
          metadata: { internal_user_id: userId, source: 'runitarcade_payouts' },
          send_customer_emails: true,
        });
      } catch (err) {
        const m = err instanceof Error ? err.message : '';
        if (/invalid email|real email address/i.test(m)) {
          return errorResponse(WHOP_EMAIL_HELP, 422);
        }
        throw err;
      }
      companyId = created.id;
      const { error: upErr } = await admin
        .from('profiles')
        .update({ whop_company_id: companyId, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (upErr) console.error('[createWhopPayoutPortalLink] failed to save whop_company_id', upErr);
    }

    const link = await whopAccountLinksCreate(whopKey, {
      company_id: companyId!,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      use_case: 'payouts_portal',
    });

    return json({ ok: true, url: link.url, whop_company_id: companyId });
  } catch (e) {
    console.error('[createWhopPayoutPortalLink]', e);
    const msg = e instanceof Error ? e.message : 'error';
    if (/invalid email|real email address/i.test(msg)) {
      return errorResponse(WHOP_EMAIL_HELP, 422);
    }
    return errorResponse(msg, 500);
  }
});
