import { Alert } from 'react-native';

/** Prize runs with the live backend require sign-in so `begin_minigame_prize_run` can debit the account. */
export function assertBackendPrizeSignedIn(enableBackend: boolean, uid: string | undefined): boolean {
  if (!enableBackend) return true;
  if (uid) return true;
  Alert.alert('Sign in required', 'Log in to play prize runs.');
  return false;
}

/** Submit with `prize_run` requires the reservation id from the run start. */
export function assertPrizeRunReservation(
  prizeRun: boolean,
  enableBackend: boolean,
  reservationId: string | null | undefined,
): boolean {
  if (!prizeRun || !enableBackend) return true;
  if (reservationId) return true;
  Alert.alert(
    'Prize run',
    'Could not verify this run. Start a new prize run from the arcade.',
  );
  return false;
}
