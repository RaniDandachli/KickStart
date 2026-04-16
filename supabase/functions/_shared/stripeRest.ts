/**
 * Stripe REST calls via fetch — avoids the official Stripe Node SDK on Edge/Deno, which can trigger
 * `Deno.core.runMicrotasks() is not supported` during worker shutdown (Node polyfills + process.nextTick).
 *
 * Bodies use application/x-www-form-urlencoded per Stripe API.
 *
 * Always read `response.text()` once, then parse — never call `json()` before handling `!ok` or the error
 * body is consumed and Stripe’s real message is lost (shows as generic "Stripe HTTP 400").
 */

const STRIPE_API = 'https://api.stripe.com/v1';

export type StripeAccountRetrieve = {
  payouts_enabled?: boolean;
  charges_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: { currently_due?: string[] };
};

/** Stripe error JSON: { error: { type, message, code, ... } } */
function messageFromStripeBody(text: string, status: number): string {
  const trimmed = text.trim();
  if (!trimmed) return `Stripe HTTP ${status}`;
  try {
    const j = JSON.parse(trimmed) as { error?: { message?: string; code?: string; type?: string } };
    if (j?.error?.message) {
      const parts = [j.error.message];
      if (j.error.code) parts.push(`(${j.error.code})`);
      return parts.join(' ');
    }
  } catch {
    /* not JSON */
  }
  return trimmed.slice(0, 1000);
}

function parseJson<T>(text: string): T {
  if (!text.trim()) {
    throw new Error('Empty response body');
  }
  return JSON.parse(text) as T;
}

/** Nested objects → Stripe bracket notation (e.g. capabilities[transfers][requested]=true). */
function appendFormParam(key: string, value: unknown, params: URLSearchParams): void {
  if (value === undefined || value === null) return;
  if (typeof value === 'boolean') {
    params.append(key, value ? 'true' : 'false');
    return;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    params.append(key, String(value));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => appendFormParam(`${key}[${i}]`, v, params));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      appendFormParam(`${key}[${k}]`, v, params);
    }
  }
}

export function buildStripeFormBody(data: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) {
    appendFormParam(k, v, params);
  }
  return params.toString();
}

export async function stripeRetrieveAccount(secret: string, accountId: string): Promise<StripeAccountRetrieve> {
  const res = await fetch(`${STRIPE_API}/accounts/${encodeURIComponent(accountId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(messageFromStripeBody(text, res.status));
  }
  return parseJson<StripeAccountRetrieve>(text);
}

/** Express Connect dashboard link; returns null if Stripe rejects (e.g. onboarding incomplete). */
export async function stripeCreateExpressLoginLink(secret: string, accountId: string): Promise<string | null> {
  const res = await fetch(`${STRIPE_API}/accounts/${encodeURIComponent(accountId)}/login_links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: '',
  });
  const text = await res.text();
  if (!res.ok) return null;
  const data = parseJson<{ url?: string }>(text);
  return typeof data.url === 'string' ? data.url : null;
}

export async function stripeAccountsCreate(secret: string, body: Record<string, unknown>): Promise<{ id: string }> {
  const res = await fetch(`${STRIPE_API}/accounts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildStripeFormBody(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(messageFromStripeBody(text, res.status));
  }
  const data = parseJson<{ id?: string }>(text);
  if (!data.id) {
    throw new Error('Stripe did not return account id');
  }
  return { id: data.id };
}

export async function stripeAccountsUpdate(secret: string, accountId: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${STRIPE_API}/accounts/${encodeURIComponent(accountId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildStripeFormBody(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(messageFromStripeBody(text, res.status));
  }
}

export async function stripeAccountLinksCreate(secret: string, body: Record<string, unknown>): Promise<{ url: string }> {
  const res = await fetch(`${STRIPE_API}/account_links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildStripeFormBody(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(messageFromStripeBody(text, res.status));
  }
  const data = parseJson<{ url?: string }>(text);
  if (typeof data.url !== 'string') {
    throw new Error('Stripe did not return account link URL');
  }
  return { url: data.url };
}
