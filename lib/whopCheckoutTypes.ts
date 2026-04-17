/** Payload from `createWhopCheckoutSession` for in-app Whop checkout (embed / WebView). */
export type WhopCheckoutPayload = {
  url: string;
  sessionId: string | null;
  returnUrl: string;
};
