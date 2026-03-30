import type { Json } from '@/types/database';

/** Saved on `profiles.shipping_address` and prize redemption snapshots. */
export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  /** State / province / county */
  region: string;
  postalCode: string;
  /** ISO country name or code — user-entered */
  country: string;
};

export function emptyShippingAddress(): ShippingAddress {
  return {
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    country: '',
  };
}

export function parseShippingAddress(raw: Json | null | undefined): ShippingAddress {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyShippingAddress();
  const o = raw as Record<string, unknown>;
  return {
    fullName: String(o.fullName ?? ''),
    line1: String(o.line1 ?? ''),
    line2: String(o.line2 ?? ''),
    city: String(o.city ?? ''),
    region: String(o.region ?? ''),
    postalCode: String(o.postalCode ?? ''),
    country: String(o.country ?? ''),
  };
}

/** Minimum fields for shipping a physical prize. */
export function isShippingAddressComplete(a: ShippingAddress): boolean {
  const req = [a.fullName, a.line1, a.city, a.postalCode, a.country].map((s) => s.trim());
  return req.every(Boolean);
}

export function shippingAddressToJson(a: ShippingAddress): Record<string, string> {
  return {
    fullName: a.fullName.trim(),
    line1: a.line1.trim(),
    line2: a.line2.trim(),
    city: a.city.trim(),
    region: a.region.trim(),
    postalCode: a.postalCode.trim(),
    country: a.country.trim(),
  };
}
