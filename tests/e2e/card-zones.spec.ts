import { test, expect } from '@playwright/test';
import { tableFixture } from './helpers.js';

test('own character details and chanted attacks are reachable from their zones', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'chanted-ready');
  try {
    const page = table.pages[0]!; await page.goto(table.url);
    const character = page.getByRole('button', { name: '自分の人物カードを確認', exact: true });
    await expect(character).toBeVisible(); await character.click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: '侍大将のシン', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('持ち技');
    await page.keyboard.press('Escape'); await expect(character).toBeFocused();
    const chants = page.getByRole('region', { name: '自分の詠唱', exact: true });
    await chants.getByRole('button', { name: '天地百撃斬の詳細を見る', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('天地百撃斬'); await page.keyboard.press('Escape');
    await chants.getByRole('button', { name: '天地百撃斬を選ぶ', exact: true }).click();
    await page.getByRole('article').filter({ has: page.getByRole('heading', { name: '楓', exact: true }) }).getByRole('checkbox').check();
    await page.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
    await page.getByRole('button', { name: '攻撃を確認して実行', exact: true }).click();
    await expect(chants.getByRole('button', { name: '天地百撃斬を選ぶ', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '現在の行動', exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'あなたの判断です' })).toBeVisible();
  } finally { await table.close(); }
});
