import type { WhopCheckoutPayload } from '@/lib/whopCheckoutTypes';

type UIHandler = (payload: WhopCheckoutPayload) => Promise<boolean>;

let ui: UIHandler | null = null;

/** Registered by `WhopCheckoutHost` on Shop so Whop can open in-app (embed / WebView) instead of only the system browser. */
export function registerWhopCheckoutUI(fn: UIHandler | null): void {
  ui = fn;
}

export async function runWhopCheckoutUI(payload: WhopCheckoutPayload, fallback: () => Promise<boolean>): Promise<boolean> {
  if (ui) return ui(payload);
  return fallback();
}
