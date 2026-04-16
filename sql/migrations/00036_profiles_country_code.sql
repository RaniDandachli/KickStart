-- ISO 3166-1 alpha-2 for Stripe Connect / payouts. Distinct from `region` (matchmaking NA/EU).
alter table public.profiles
  add column if not exists country_code text;

comment on column public.profiles.country_code is
  'ISO 3166-1 alpha-2 (e.g. US, CA). Legal residence for payouts; set at signup or profile.';
