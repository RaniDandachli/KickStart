/**
 * Maps Supabase Auth errors to short, actionable copy.
 * @see https://github.com/supabase/gotrue-js/blob/master/src/lib/errors.ts
 */
export function formatAuthError(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number } | undefined;
  const raw = (e?.message ?? '').trim();
  const msg = raw.toLowerCase();
  const code = (e?.code ?? '').toLowerCase();

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // Never show raw codes/status in Alert copy; log for debugging only.
    console.warn('[auth]', { message: raw, code: e?.code, status: e?.status });
  }

  const looksLikeWrongPassword =
    code === 'invalid_credentials' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials');

  if (looksLikeWrongPassword) {
    return "That email or password doesn't match. Try again, or tap Forgot password.";
  }

  const looksLikeEmailNotConfirmed =
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed') ||
    msg.includes('email address not confirmed') ||
    msg.includes('confirm your email') ||
    (msg.includes('not confirmed') && msg.includes('email'));

  if (looksLikeEmailNotConfirmed) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '[auth] email_not_confirmed — user must verify inbox; in dev you can confirm the user in your auth provider dashboard.',
      );
    }
    return 'Confirm your email using the link we sent you, then try signing in again.';
  }

  return raw || 'Something went wrong. Please try again.';
}
