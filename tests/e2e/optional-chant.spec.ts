import { test, expect } from '@playwright/test';
import { tableFixture } from './helpers.js';

test('Lancaster explicitly opts into chanting his lance', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'optional-chant-ready');
  try {
    const page = table.pages[0]!; await page.goto(table.url);
    const hand = page.getByRole('region', { name: '自分の手札', exact: true });
    await hand.getByRole('button', { name: '竜殺天空槍', exact: true }).click();
    const chant = page.getByRole('button', { name: '詠唱', exact: true });
    await expect(chant).toBeDisabled();
    await page.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
    await expect(chant).toBeEnabled();
    await chant.click();
    await expect(hand.getByRole('button', { name: '竜殺天空槍', exact: true })).toHaveCount(0);
    const zone = page.getByRole('region', { name: '自分の詠唱', exact: true });
    await expect(zone.getByRole('button', { name: '竜殺天空槍の詳細を見る', exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '手札上限は' })).toBeVisible();
  } finally { await table.close(); }
});
