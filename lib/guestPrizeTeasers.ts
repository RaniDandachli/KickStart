import type { PrizeCatalogRow } from '@/types/database';

/**
 * Rich sample catalog for signed-out / demo users — mirrors real prize rows for the shop UI.
 * (Not from DB; redeem flows route to sign-in or local preview.)
 */
export type GuestPrizeTeaser = {
  id: string;
  title: string;
  description: string;
  cost_redeem_tickets: number;
  requires_shipping: boolean;
  stock_remaining: number | null;
  image_url: string | null;
};

export const GUEST_PRIZE_TEASERS: GuestPrizeTeaser[] = [
  {
    id: 'guest-teaser-amazon',
    title: '$50 Amazon Gift Card',
    description: 'Digital code emailed after you redeem — stack with Prime Day.',
    cost_redeem_tickets: 32,
    requires_shipping: false,
    stock_remaining: null,
    image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=640&q=80',
  },
  {
    id: 'guest-teaser-airpods',
    title: 'Apple AirPods Pro',
    description: 'Active noise cancellation — shipped to your address.',
    cost_redeem_tickets: 118,
    requires_shipping: true,
    stock_remaining: 14,
    image_url: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=640&q=80',
  },
  {
    id: 'guest-teaser-visa',
    title: '$100 Visa Prepaid',
    description: 'Spend anywhere Visa Debit is accepted — digital delivery.',
    cost_redeem_tickets: 72,
    requires_shipping: false,
    stock_remaining: null,
    image_url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=640&q=80',
  },
  {
    id: 'guest-teaser-switch',
    title: 'Nintendo Switch OLED',
    description: 'Console bundle — physical prize, signature required.',
    cost_redeem_tickets: 220,
    requires_shipping: true,
    stock_remaining: 6,
    image_url: 'https://images.unsplash.com/photo-1578303512597-81e6f205afd9?w=640&q=80',
  },
  {
    id: 'guest-teaser-starbucks',
    title: '$25 Starbucks Card',
    description: 'Reload your app or scan in-store — instant digital code.',
    cost_redeem_tickets: 18,
    requires_shipping: false,
    stock_remaining: null,
    image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=640&q=80',
  },
  {
    id: 'guest-teaser-playstation',
    title: '$60 PlayStation Store',
    description: 'Top up your PSN wallet for games and add-ons.',
    cost_redeem_tickets: 42,
    requires_shipping: false,
    stock_remaining: null,
    image_url: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=640&q=80',
  },
  {
    id: 'guest-teaser-ipad',
    title: 'iPad (10th gen)',
    description: 'Thin, colorful tablet — ships insured to you.',
    cost_redeem_tickets: 280,
    requires_shipping: true,
    stock_remaining: 4,
    image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=640&q=80',
  },
];

/** Feed {@link getNextRewardTarget} while showing teaser tiles. */
export function guestTeasersAsCatalogRows(teasers: GuestPrizeTeaser[]): PrizeCatalogRow[] {
  return teasers.map((t, i) => ({
    id: t.id,
    slug: t.id,
    title: t.title,
    description: t.description,
    image_url: t.image_url ?? '',
    cost_redeem_tickets: t.cost_redeem_tickets,
    sort_order: i,
    is_active: true,
    stock_remaining: t.stock_remaining,
    requires_shipping: t.requires_shipping,
    created_at: '',
    updated_at: '',
  }));
}
