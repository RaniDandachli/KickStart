-- Sample prize rows — edit or add via Supabase Table Editor.
-- image_url: upload to Storage (public bucket) and paste URL, or use any HTTPS image URL.

insert into public.prize_catalog (slug, title, description, image_url, cost_redeem_tickets, sort_order, is_active, stock_remaining, requires_shipping)
values
  (
    'kickclash-hat-demo',
    'KickClash cap',
    'Adjustable cap — ships to verified address after redemption.',
    'https://placehold.co/800x500/1e293b/fbbf24/png?text=Prize+photo',
    2500,
    0,
    true,
    null,
    true
  ),
  (
    'gift-card-10-demo',
    '$10 gift card',
    'Digital code emailed within 3 business days.',
    'https://placehold.co/800x500/0f172a/34d399/png?text=Gift+card',
    12000,
    1,
    true,
    50,
    false
  )
on conflict (slug) do nothing;
