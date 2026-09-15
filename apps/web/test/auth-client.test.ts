import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); });

it('returns a recoverable error when auth requests fail at the network boundary', async () => {
  vi.resetModules();
  const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', fetch);
  const { sendLoginCode, verifyLoginCode, listPasskeys, deletePasskey, signOut } = await import('../src/auth-client.js');
  for (const action of [
    () => sendLoginCode('offline@example.com'),
    () => verifyLoginCode('offline@example.com', '123456', 'Offline'),
    () => listPasskeys(),
    () => deletePasskey('credential'),
    () => signOut(),
  ]) {
    await expect(action()).resolves.toMatchObject({ data: null, error: { code: 'NETWORK_ERROR' } });
  }
  expect(fetch).toHaveBeenCalledTimes(5);
});
