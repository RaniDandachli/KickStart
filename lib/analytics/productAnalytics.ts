/**
 * Product / economy analytics — wire to your pipeline (Segment, Amplitude, etc.).
 *
 * Emitted today (hook backend + warehouse for aggregates):
 * - `h2h_loss_credits_granted` — tier / credits / source (server | guest_preview)
 * - `h2h_win_prize_credited` — wallet_cents
 * - `h2h_loss_to_arcade_cta` — funnel: loss screen → Play Arcade
 * - `arcade_credit_spend` — guest prize-run entry (local store)
 *
 * Future: ticket grants after loss (minigame end), retention cohorts, server-side spend mirror.
 */

export type ProductAnalyticsProps = Record<string, string | number | boolean | undefined>;

export function trackProductEvent(eventName: string, props?: ProductAnalyticsProps): void {
  if (__DEV__) {
    console.log(`[productAnalytics] ${eventName}`, props ?? {});
  }
  /* Production: forward `eventName` + props to your analytics SDK here. */
}
