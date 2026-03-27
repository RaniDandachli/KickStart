import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

const Body = z.object({
  stripe_customer_id: z.string().optional(),
  stripe_subscription_id: z.string().optional(),
  status: z.enum(['inactive', 'trialing', 'active', 'past_due', 'canceled']),
  plan_key: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return errorResponse('Unauthorized', 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message, 422);

    const admin = createClient(supabaseUrl, serviceKey);
    // TODO: Verify Stripe signature webhook path instead of client-triggered updates in production.
    if (!stripeSecret) {
      console.warn('STRIPE_SECRET_KEY missing — scaffold mode');
    }

    const { error } = await admin.from('subscriptions').upsert(
      {
        user_id: userData.user.id,
        stripe_customer_id: parsed.data.stripe_customer_id ?? null,
        stripe_subscription_id: parsed.data.stripe_subscription_id ?? null,
        status: parsed.data.status,
        plan_key: parsed.data.plan_key ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) return errorResponse(error.message, 500);

    await admin.from('transactions').insert({
      user_id: userData.user.id,
      kind: 'subscription_event',
      amount: 0,
      currency: 'credits',
      description: `Subscription ${parsed.data.status}`,
      metadata: parsed.data,
    });

    return json({ ok: true });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'error', 500);
  }
});
