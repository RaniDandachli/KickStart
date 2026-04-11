import { parseRecoveryTokensFromUrl } from '@/lib/authPasswordRecovery';

describe('parseRecoveryTokensFromUrl', () => {
  it('parses hash fragment with recovery type', () => {
    const url =
      'runit://auth#access_token=abc&refresh_token=def&type=recovery';
    expect(parseRecoveryTokensFromUrl(url)).toEqual({
      access_token: 'abc',
      refresh_token: 'def',
    });
  });

  it('returns null without tokens', () => {
    expect(parseRecoveryTokensFromUrl('runit://auth')).toBeNull();
  });
});
