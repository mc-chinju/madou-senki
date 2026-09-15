import { test, expect } from '@playwright/test';
import { signIn } from './helpers.js';

test('four independent accounts join by invitation, ready, start through the normal API and resume after reload', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL must be configured');
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ baseURL })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const [index, page] of pages.entries()) {
      await signIn(contexts[index]!, ['葵', '楓', '凛', '蓮'][index]!);
      await page.goto('/');
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
    for (const page of pages) await expect(page.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
    await pages[1]!.reload();
    await expect(pages[1]!.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
