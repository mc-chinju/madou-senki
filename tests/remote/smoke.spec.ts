import { test, expect } from '@playwright/test';

test('invite, ready, start and reload on the remote origin', async ({ browser, baseURL, request }) => {
  if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL must be configured');
  const fixture = await request.post('/__test/rooms/x/scenario', { data: { name: 'setup' } });
  expect(fixture.ok()).toBe(false);
  expect([404, 405]).toContain(fixture.status());
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ baseURL })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const [index, page] of pages.entries()) {
      await page.goto('/');
      await page.getByLabel('表示名').fill(`遠隔${index}`);
      await page.getByRole('button', { name: 'はじめる', exact: true }).click();
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
  const context = await browser.newContext({ baseURL });
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
    await page.getByLabel('表示名').fill('再送');
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
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
