/**
 * Maps Supabase Auth errors to short, actionable copy.
 * @see https://github.com/supabase/gotrue-js/blob/master/src/lib/errors.ts
 */
export function formatAuthError(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number } | undefined;
  const raw = (e?.message ?? '').trim();
  const msg = raw.toLowerCase();
  const code = (e?.code ?? '').toLowerCase();

  const looksLikeEmailNotConfirmed =
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed') ||
    msg.includes('email address not confirmed') ||
    msg.includes('confirm your email') ||
    (msg.includes('not confirmed') && msg.includes('email'));

  if (looksLikeEmailNotConfirmed) {
    return [
      'Supabase still has this user as “unconfirmed”. Turning the switch off only affects new sign-ups.',
      '',
      'Fix (pick one):',
      '• Dashboard → Authentication → Users → your user → Confirm user (or “Confirm email” in the row menu),',
      '• Or delete that user and create the account again.',
      '',
      'Then confirm: Authentication → Providers → Email → “Confirm email” is off and you saved.',
    ].join('\n');
  }

  const base = raw || 'Something went wrong';
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return `${base}\n\n[debug] code=${e?.code ?? 'n/a'} status=${e?.status ?? 'n/a'}`;
  }
  return base;
}
