-- Example reward_catalog + gift_card_inventory + prize_catalog links.
-- Run after migrations (including 00006_gift_card_redemption.sql) and prize_catalog seed.
-- prize_catalog slugs below must match rows that sell those Amazon amounts; without these UPDATEs,
-- gift_card_inventory rows exist but the shop row is not on the gift-card RPC path (reward_catalog_id null).
-- Replace placeholder codes before production; never commit real live codes.

insert into public.reward_catalog (reward_key, reward_name, brand, value_amount, currency, ticket_cost, is_active)
values
  ('amazon_10_usd', 'Amazon $10 gift card', 'Amazon', 10, 'USD', 5500, true),
  ('amazon_25_usd', 'Amazon $25 gift card', 'Amazon', 25, 'USD', 13500, true),
  ('amazon_50_usd', 'Amazon $50 gift card', 'Amazon', 50, 'USD', 27500, true)
on conflict (reward_key) do update set
  reward_name = excluded.reward_name,
  brand = excluded.brand,
  value_amount = excluded.value_amount,
  currency = excluded.currency,
  ticket_cost = excluded.ticket_cost,
  is_active = excluded.is_active;

-- Sample inventory (admin should load real codes via secure process)
insert into public.gift_card_inventory (brand, reward_name, value_amount, currency, code, pin, is_used)
values
  ('Amazon', 'Amazon $10 gift card', 10, 'USD', 'AMZN-DEMO-10-001', null, false),
  ('Amazon', 'Amazon $10 gift card', 10, 'USD', 'AMZN-DEMO-10-002', null, false),
  ('Amazon', 'Amazon $25 gift card', 25, 'USD', 'AMZN-DEMO-25-001', null, false),
  ('Amazon', 'Amazon $50 gift card', 50, 'USD', 'AMZN-DEMO-50-001', null, false)
on conflict (code) do nothing;

-- Link shop rows (adjust slugs to match your prize_catalog)
update public.prize_catalog pc
set reward_catalog_id = rc.id
from public.reward_catalog rc
where pc.slug = 'gift-card-10-demo' and rc.reward_key = 'amazon_10_usd';

update public.prize_catalog pc
set reward_catalog_id = rc.id
from public.reward_catalog rc
where pc.slug = 'amazon-giftcard-25-test' and rc.reward_key = 'amazon_25_usd';

update public.prize_catalog pc
set reward_catalog_id = rc.id
from public.reward_catalog rc
where pc.slug = 'gift-card-50' and rc.reward_key = 'amazon_50_usd';
