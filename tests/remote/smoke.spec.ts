import { test, expect } from '@playwright/test';
import { remoteSessionCookies, useSessionCookie } from './sessions.js';

test('the remote origin exposes no test fixtures, guest sessions or unauthenticated seating', async ({ baseURL, request }) => {
  if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL must be configured');
  for (const path of ['/__test/rooms/x/scenario', '/__test/session']) {
    const fixture = await request.post(path, { data: { name: 'setup' } });
    expect(fixture.ok()).toBe(false);
    expect([403, 404, 405]).toContain(fixture.status());
  }
  expect((await request.post('/api/sessions', { data: { name: 'ゲスト' }, headers: { Origin: baseURL } })).status()).toBe(404);
  expect((await request.post(`/api/rooms/${crypto.randomUUID()}/join`, { data: {}, headers: { Origin: baseURL } })).status()).toBe(401);
});

test('invite, ready, start and reload on the remote origin', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL must be configured');
  const cookies = remoteSessionCookies(4);
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ baseURL })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const [index, page] of pages.entries()) {
      await useSessionCookie(contexts[index]!, baseURL, cookies[index]!);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible();
    }
    const owner = pages[0]!;
    await owner.getByLabel('卓名', { exact: true }).fill('staging確認');
    await owner.getByLabel('招待限定', { exact: true }).check();
    await owner.getByRole('button', { name: '卓を作る', exact: true }).click();
    await expect(owner.getByRole('heading', { name: 'staging確認', exact: true })).toBeVisible();
    await owner.getByRole('button', { name: '招待リンクを発行', exact: true }).click();
    const link = await owner.getByLabel('招待リンク', { exact: true }).inputValue();
    expect(new URL(link).hash).toContain('invite=');
    for (const page of pages.slice(1)) {
      await page.goto(link);
      await page.getByRole('button', { name: 'この卓に参加する', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'staging確認', exact: true })).toBeVisible();
    }
    for (const page of pages) {
      await page.getByRole('button', { name: '準備完了', exact: true }).click();
      await expect(page.getByRole('button', { name: '準備を取り消す', exact: true })).toBeVisible();
    }
    await expect(owner.getByRole('button', { name: '対戦を始める', exact: true })).toBeEnabled();
    await owner.getByRole('button', { name: '対戦を始める', exact: true }).click();
    for (const page of pages) await expect(page.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
    await pages[2]!.reload();
    await expect(pages[2]!.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('an ACK lost after commit is replayed with the exact same command after reload', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL must be configured');
  const cookies = remoteSessionCookies(1);
  const context = await browser.newContext({ baseURL });
  await useSessionCookie(context, baseURL, cookies[0]!);
  const page = await context.newPage();
  try {
    let dropped = false;
    const sent: string[] = [];
    const acknowledgements: { commandId: string; revision: number }[] = [];
    await page.routeWebSocket('**/api/rooms/*/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => { sent.push(String(message)); server.send(message); });
      server.onMessage(message => {
        const parsed = JSON.parse(String(message));
        if (parsed.type === 'ack') {
          acknowledgements.push(parsed);
          if (!dropped) { dropped = true; return; }
        }
        route.send(message);
      });
    });
    await page.goto('/');
    await page.getByLabel('卓名', { exact: true }).fill('ACK確認');
    await page.getByLabel('招待限定', { exact: true }).check();
    await page.getByRole('button', { name: '卓を作る', exact: true }).click();
    await expect(page.getByRole('button', { name: '準備完了', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '準備完了', exact: true }).click();
    await expect.poll(() => dropped).toBe(true);
    await page.reload();
    await expect(page.getByRole('button', { name: '準備を取り消す', exact: true })).toBeEnabled();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toBe(sent[0]);
    expect(acknowledgements).toHaveLength(2);
    expect(acknowledgements[1]).toEqual(acknowledgements[0]);
  } finally { await context.close(); }
});
