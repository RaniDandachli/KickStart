import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { invokeEdgeFunction } from '@/lib/supabaseEdgeInvoke';

/**
 * After the signed-in user successfully enters the H2H waiting queue, asks the server to run the
 * open-slot notify scan so other users (with alerts matching this contest) get Expo / web push.
 * Fire-and-forget; duplicates are deduped server-side (`h2h_open_slot_notify_log`).
 */
export function requestOpenMatchWatchScan(): void {
  if (!ENABLE_BACKEND) return;
  void invokeEdgeFunction('triggerOpenMatchWatchScan', { body: {} }).then(({ error }) => {
    if (error) console.warn('[requestOpenMatchWatchScan]', error.message);
  });
}
