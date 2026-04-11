/**
 * Supabase recovery emails redirect with tokens in the URL fragment:
 * `scheme://path#access_token=...&refresh_token=...&type=recovery`
 */
export function parseRecoveryTokensFromUrl(url: string): {
  access_token: string;
  refresh_token: string;
} | null {
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');
  const tail = hashIdx >= 0 ? url.slice(hashIdx + 1) : queryIdx >= 0 ? url.slice(queryIdx + 1) : '';
  if (!tail) return null;
  const params = new URLSearchParams(tail);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  if (!access_token || !refresh_token) return null;
  if (type && type !== 'recovery') return null;
  return { access_token, refresh_token };
}
