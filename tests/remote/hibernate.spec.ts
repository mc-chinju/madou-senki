import { test, expect } from '@playwright/test';
import { remoteSessionCookies, useSessionCookie } from './sessions.js';

const idleMs = Number(process.env.REMOTE_HIBERNATE_MS ?? 15 * 60 * 1000);

test('idle Durable Object resume keeps the same cookie, hand and revision', async ({ browser, baseURL }) => {
  test.skip(!process.env.REMOTE_HIBERNATE, 'set REMOTE_HIBERNATE=1 to wait for DO hibernation');
  const cookies = remoteSessionCookies(1);
  test.skip(!cookies, 'set REMOTE_SESSION_COOKIES to a registered account');
  test.setTimeout(idleMs + 120_000);
  if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL must be configured');
  const context = await browser.newContext({ baseURL });
  const page = await pageFor(context, baseURL, cookies![0]!);
  await page.getByLabel('卓名', { exact: true }).fill('休止確認');
  await page.getByLabel('招待限定', { exact: true }).check();
  await page.getByRole('button', { name: '卓を作る', exact: true }).click();
  await expect(page.getByRole('heading', { name: '休止確認', exact: true })).toBeVisible();
  const roomId = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.getByRole('button', { name: '準備完了', exact: true }).click();
  await expect(page.getByRole('button', { name: '準備を取り消す', exact: true })).toBeVisible();
  const before = await snapshot(page, roomId);
  const state = await context.storageState();
  await context.close();
  await new Promise(resolve => setTimeout(resolve, idleMs));
  const resumed = await browser.newContext({ baseURL, storageState: state });
  try {
    const next = await resumed.newPage();
    await next.goto(`/rooms/${roomId}`);
    await expect(next.getByRole('button', { name: '準備を取り消す', exact: true })).toBeVisible();
    const after = await snapshot(next, roomId);
    expect(after).toEqual(before);
  } finally { await resumed.close(); }
});

async function pageFor(context: import('@playwright/test').BrowserContext, baseURL: string, cookie: string) {
  await useSessionCookie(context, baseURL, cookie);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible();
  return page;
}

async function snapshot(page: import('@playwright/test').Page, roomId: string) {
  const response = await page.request.get(`/api/rooms/${roomId}/snapshot`);
  expect(response.ok(), `snapshot ${response.status()}`).toBe(true);
  return response.json() as Promise<{ revision: number }>;
}
