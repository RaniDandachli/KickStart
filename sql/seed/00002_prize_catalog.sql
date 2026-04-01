-- Prize catalog — ticket costs aligned with earn / IAP model (see lib/ticketPayouts, lib/purchaseEconomy).
-- image_url: upload to Storage (public bucket) and paste URL, or use any HTTPS image URL.

insert into public.prize_catalog (slug, title, description, image_url, cost_redeem_tickets, sort_order, is_active, stock_remaining, requires_shipping)
values
  (
    'cosmetic-basic',
    'Cosmetic',
    'In-game cosmetic unlock — digital delivery.',
    'https://placehold.co/800x500/1e1b4b/a78bfa/png?text=Cosmetic',
    800,
    0,
    true,
    null,
    false
  ),
  (
    'cosmetic-premium',
    'Premium cosmetic',
    'Premium in-game cosmetic — digital delivery.',
    'https://placehold.co/800x500/312e81/c4b5fd/png?text=Premium',
    1500,
    1,
    true,
    null,
    false
  ),
  (
    'kickclash-hat-demo',
    'KickClash cap',
    'Adjustable cap — ships to verified address after redemption.',
    'https://placehold.co/800x500/1e293b/fbbf24/png?text=Prize+photo',
    2500,
    2,
    true,
    null,
    true
  ),
  (
    'gift-card-5',
    '$5 gift card',
    'Digital code emailed within 3 business days.',
    'https://placehold.co/800x500/0f172a/34d399/png?text=%245+Gift',
    2750,
    3,
    true,
    null,
    false
  ),
  (
    'gift-card-10-demo',
    '$10 Amazon gift card',
    'Digital claim — code sent to your account email after redemption.',
    'https://placehold.co/800x500/0c1e2e/ff9900/png?text=Amazon+%2410',
    5500,
    4,
    true,
    50,
    false
  ),
  (
    'amazon-giftcard-25-test',
    '$25 Amazon gift card',
    'Digital claim — code or fulfillment details sent per your account email.',
    'https://placehold.co/800x500/0c1e2e/ff9900/png?text=Amazon+%2425',
    13500,
    5,
    true,
    null,
    false
  ),
  (
    'gift-card-50',
    '$50 Amazon gift card',
    'Digital claim — code sent to your account email after redemption.',
    'https://placehold.co/800x500/0c1e2e/ff9900/png?text=Amazon+%2450',
    27500,
    6,
    true,
    null,
    false
  )
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  image_url = excluded.image_url,
  cost_redeem_tickets = excluded.cost_redeem_tickets,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  stock_remaining = excluded.stock_remaining,
  requires_shipping = excluded.requires_shipping;
