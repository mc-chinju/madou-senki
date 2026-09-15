import type { BrowserContext } from '@playwright/test';

/**
 * Remote origins have no test session route and OTP mail cannot be read by the test, so remote runs use
 * sessions of accounts registered beforehand: REMOTE_SESSION_COOKIES='["__Secure-madou.session_token=...", ...]'.
 * The cookies are secrets; pass them through the environment only.
 */
export function remoteSessionCookies(count: number): string[] | null {
  const raw = process.env.REMOTE_SESSION_COOKIES;
  if (!raw) return null;
  const cookies = JSON.parse(raw) as unknown;
  if (!Array.isArray(cookies) || !cookies.every(cookie => typeof cookie === 'string' && cookie.includes('='))) throw new Error('REMOTE_SESSION_COOKIES must be a JSON array of name=value strings');
  return cookies.length >= count ? cookies.slice(0, count) : null;
}

export async function useSessionCookie(context: BrowserContext, baseURL: string, cookie: string): Promise<void> {
  const separator = cookie.indexOf('=');
  await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: baseURL,
    httpOnly: true, secure: baseURL.startsWith('https:'), sameSite: 'Lax' }]);
}
