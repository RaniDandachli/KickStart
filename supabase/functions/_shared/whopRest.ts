/** Whop REST API (https://api.whop.com/api/v1) — fetch-only, no Node SDK on Edge. */

const WHOP_API_V1 = 'https://api.whop.com/api/v1';

function whopErrorMessage(data: unknown): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error?: { message?: string } }).error;
    if (err?.message) return err.message;
  }
  return 'Whop request failed';
}

export type WhopCompanyCreateBody = {
  title: string;
  email: string;
  parent_company_id: string;
  metadata?: Record<string, string>;
  send_customer_emails?: boolean;
};

export type WhopCompany = {
  id: string;
};

export async function whopCompaniesCreate(
  apiKey: string,
  body: WhopCompanyCreateBody,
): Promise<WhopCompany> {
  const res = await fetch(`${WHOP_API_V1}/companies`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as unknown;
  if (!res.ok) {
    throw new Error(whopErrorMessage(data));
  }
  const id = (data as { id?: string }).id;
  if (!id) throw new Error('Whop: create company returned no id');
  return { id };
}

export type WhopAccountLinkCreateBody = {
  company_id: string;
  refresh_url: string;
  return_url: string;
  /** Hosted payouts + KYC — see Whop account link docs */
  use_case: 'payouts_portal' | 'account_onboarding';
};

export type WhopAccountLink = {
  url: string;
};

export async function whopAccountLinksCreate(
  apiKey: string,
  body: WhopAccountLinkCreateBody,
): Promise<WhopAccountLink> {
  const res = await fetch(`${WHOP_API_V1}/account_links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as unknown;
  if (!res.ok) {
    throw new Error(whopErrorMessage(data));
  }
  const url = (data as { url?: string }).url;
  if (!url) throw new Error('Whop: account link returned no url');
  return { url };
}

/** USD amount as decimal dollars (e.g. 10.5 for $10.50) — matches Whop OpenAPI. */
export type WhopTransferCreateBody = {
  amount: number;
  currency: 'usd';
  origin_id: string;
  destination_id: string;
  idempotence_key?: string | null;
  metadata?: Record<string, string>;
  notes?: string | null;
};

export type WhopTransfer = {
  id: string;
};

/** Inline plan for `POST /checkout_configurations` with `mode: "payment"`. */
export type WhopCheckoutPlanInline = {
  company_id: string;
  currency: 'usd';
  plan_type: 'one_time';
  release_method: 'buy_now';
  /** Price in USD dollars (e.g. 10.59). */
  initial_price: number;
  title?: string | null;
  product?: {
    external_identifier: string;
    title: string;
    visibility?: 'hidden' | 'visible' | 'archived' | 'quick_link' | null;
  } | null;
};

export type WhopCheckoutConfigurationCreateBody = {
  mode: 'payment';
  plan: WhopCheckoutPlanInline;
  metadata?: Record<string, string>;
  redirect_url: string;
  /** Page where checkout was opened (Whop API). */
  source_url?: string | null;
};

export type WhopCheckoutConfiguration = {
  id?: string;
  /** May be relative; prefix with `https://whop.com` if needed. */
  purchase_url: string;
};

export async function whopCheckoutConfigurationsCreate(
  apiKey: string,
  body: WhopCheckoutConfigurationCreateBody,
): Promise<WhopCheckoutConfiguration> {
  const res = await fetch(`${WHOP_API_V1}/checkout_configurations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as unknown;
  if (!res.ok) {
    throw new Error(whopErrorMessage(data));
  }
  const d = data as { purchase_url?: string; id?: string; checkout_configuration?: { id?: string } };
  const purchase_url = d.purchase_url;
  if (!purchase_url) throw new Error('Whop: checkout configuration returned no purchase_url');
  const id = d.id ?? d.checkout_configuration?.id;
  return { purchase_url, id };
}

export async function whopTransfersCreate(apiKey: string, body: WhopTransferCreateBody): Promise<WhopTransfer> {
  const res = await fetch(`${WHOP_API_V1}/transfers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as unknown;
  if (!res.ok) {
    throw new Error(whopErrorMessage(data));
  }
  const id = (data as { id?: string }).id;
  if (!id) throw new Error('Whop: transfer returned no id');
  return { id };
}
