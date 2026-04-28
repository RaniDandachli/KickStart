-- Single source for cash-out fee rate: Edge Functions + authenticated clients read here (no duplicated .env previews).

ALTER TABLE public.platform_economy
  ADD COLUMN IF NOT EXISTS withdraw_platform_fee_bps smallint NOT NULL DEFAULT 0
    CHECK (withdraw_platform_fee_bps >= 0 AND withdraw_platform_fee_bps <= 9999);

COMMENT ON COLUMN public.platform_economy.withdraw_platform_fee_bps IS
  'Basis points withheld from gross wallet withdrawal before Stripe Transfer / Whop (e.g. 250 = 2.50%). Operators change via UPDATE on id=1.';

CREATE OR REPLACE FUNCTION public.get_withdraw_platform_fee_bps()
RETURNS smallint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT withdraw_platform_fee_bps FROM public.platform_economy WHERE id = 1;
$$;

COMMENT ON FUNCTION public.get_withdraw_platform_fee_bps() IS
  'Public read — fee used by withdraw Edge Functions and withdraw UI previews.';

GRANT EXECUTE ON FUNCTION public.get_withdraw_platform_fee_bps() TO authenticated;
