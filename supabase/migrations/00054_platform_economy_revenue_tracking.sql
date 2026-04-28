-- Platform revenue bookkeeping: Money Challenge entry fees accumulate here; withdrawal fee margin (via Edge Functions) increments withdraw column.

CREATE TABLE IF NOT EXISTS public.platform_economy (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_challenge_entry_fee_cents bigint NOT NULL DEFAULT 0 CHECK (total_challenge_entry_fee_cents >= 0),
  total_withdraw_fee_revenue_cents bigint NOT NULL DEFAULT 0 CHECK (total_withdraw_fee_revenue_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_economy (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.platform_economy IS
  'Singleton row (id=1): accumulated challenge entry fees credited from users wallets; cumulative platform fee withheld on withdrawals (Stripe/Whop sends net only). Financial truth is Stripe/Whop + bank — this row is authoritative app ledger for analytics.';

ALTER TABLE public.platform_economy ENABLE ROW LEVEL SECURITY;

-- No policies: block PostgREST for anon/authenticated; service_role bypasses RLS.

REVOKE ALL ON public.platform_economy FROM PUBLIC;
REVOKE SELECT ON public.platform_economy FROM anon, authenticated;

-- Service-role Edge Functions only — GRANT after CREATE below.

CREATE OR REPLACE FUNCTION public.platform_credit_challenge_entry_fee(p_cents int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_cents IS NULL OR p_cents < 1 THEN RETURN; END IF;
  UPDATE public.platform_economy
  SET
    total_challenge_entry_fee_cents = total_challenge_entry_fee_cents + p_cents::bigint,
    updated_at = now()
  WHERE id = 1;
END;
$$;

COMMENT ON FUNCTION public.platform_credit_challenge_entry_fee(int) IS
  'Called from enter_money_challenge_wallet after successfully debiting the user — mirrors fee into platform rollup.';

CREATE OR REPLACE FUNCTION public.platform_credit_withdraw_fee_revenue(p_cents bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_cents IS NULL OR p_cents < 1 THEN RETURN; END IF;
  UPDATE public.platform_economy
  SET
    total_withdraw_fee_revenue_cents = total_withdraw_fee_revenue_cents + p_cents::bigint,
    updated_at = now()
  WHERE id = 1;
END;
$$;

COMMENT ON FUNCTION public.platform_credit_withdraw_fee_revenue(bigint) IS
  'Edge withdrawWallet*: after net transfer to user, records platform withhold amount.';

GRANT EXECUTE ON FUNCTION public.platform_credit_challenge_entry_fee(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_credit_withdraw_fee_revenue(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.enter_money_challenge_wallet(
  p_challenge_id text,
  p_calendar_day text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_fee int;
  v_slug text := nullif(trim(p_challenge_id), '');
  cd text := nullif(trim(p_calendar_day), '');
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF cd IS NULL OR cd !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_calendar_day');
  END IF;

  IF v_slug = 'money_tapdash_hot' THEN v_fee := 500;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_challenge');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.money_challenge_daily_payments p
    WHERE p.user_id = v_me AND p.challenge_id = v_slug AND p.calendar_day = cd
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_unlocked', true, 'challenge_id', v_slug, 'paid_cents', v_fee);
  END IF;

  UPDATE public.profiles
  SET wallet_cents = wallet_cents - v_fee, updated_at = now()
  WHERE id = v_me AND wallet_cents >= v_fee;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_wallet');
  END IF;

  INSERT INTO public.transactions (user_id, kind, amount, currency, description, metadata)
  VALUES (
    v_me,
    'money_challenge_entry',
    v_fee,
    'wallet_cents',
    'Money Challenge entry',
    jsonb_build_object('challenge_id', v_slug, 'calendar_day', cd, 'platform_revenue_cents', v_fee)
  );

  INSERT INTO public.money_challenge_daily_payments (user_id, challenge_id, calendar_day, paid_cents)
  VALUES (v_me, v_slug, cd, v_fee);

  PERFORM public.platform_credit_challenge_entry_fee(v_fee);

  RETURN jsonb_build_object('ok', true, 'challenge_id', v_slug, 'paid_cents', v_fee);
END;
$$;

COMMENT ON FUNCTION public.enter_money_challenge_wallet(text, text) IS
  'Debit wallet once per day per paid challenge; increments platform_economy.total_challenge_entry_fee_cents.';

GRANT EXECUTE ON FUNCTION public.enter_money_challenge_wallet(text, text) TO authenticated;
