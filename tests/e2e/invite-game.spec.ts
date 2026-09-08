import { test, expect } from '@playwright/test';

test('four independent guests join by invitation, ready, reach the guarded start and resume a local setup fixture', async ({ browser, request }) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ baseURL: 'http://localhost:8787' })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const [index, page] of pages.entries()) {
      await page.goto('/'); await page.getByLabel('表示名').fill(['葵', '楓', '凛', '蓮'][index]!);
      await page.getByRole('button', { name: 'はじめる', exact: true }).click();
      await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible();
    }
    const owner = pages[0]!;
    await owner.getByLabel('卓名', { exact: true }).fill('招待対戦');
    await owner.getByLabel('招待限定', { exact: true }).check();
    await owner.getByRole('button', { name: '卓を作る', exact: true }).click();
    await expect(owner.getByRole('heading', { name: '招待対戦', exact: true })).toBeVisible();
    await owner.getByRole('button', { name: '招待リンクを発行', exact: true }).click();
    const link = await owner.getByLabel('招待リンク', { exact: true }).inputValue();
    expect(new URL(link).hash).toContain('invite='); expect(new URL(link).search).toBe('');
    for (const page of pages.slice(1)) {
      await page.goto(link); await page.getByRole('button', { name: 'この卓に参加する', exact: true }).click();
      await expect(page.getByRole('heading', { name: '招待対戦', exact: true })).toBeVisible();
      expect(new URL(page.url()).hash).toBe('');
    }
    for (const page of pages) { await page.getByRole('button', { name: '準備完了', exact: true }).click(); await expect(page.getByRole('button', { name: '準備を取り消す', exact: true })).toBeVisible(); }
    await expect(owner.getByRole('button', { name: '対戦を始める', exact: true })).toBeEnabled();
    await owner.getByRole('button', { name: '対戦を始める', exact: true }).click();
    await expect(owner.getByRole('alert')).toContainText('対戦ルールを準備中です');
    const roomId = new URL(owner.url()).pathname.split('/').at(-1)!;
    const fixture = await request.post(`/__test/rooms/${roomId}/scenario`, { data: { name: 'setup' } });
    expect(fixture.ok()).toBe(true);
    for (const page of pages) await expect(page.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
    await pages[1]!.reload();
    await expect(pages[1]!.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
