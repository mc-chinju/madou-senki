import { test, expect } from '@playwright/test';
import { tableFixture } from './helpers.js';

test('reload restores the same public interruption priority without auto-passing', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'third-party-interrupt');
  try {
    for (const page of table.pages) await page.goto(table.url);
    await expect(table.pages[0]!.getByRole('status').filter({ hasText: '凛さんの判断を待っています' })).toBeVisible();
    await table.pages[2]!.reload();
    await expect(table.pages[2]!.getByRole('button', { name: 'パス', exact: true })).toBeEnabled();
    await table.pages[2]!.getByRole('button', { name: 'パス', exact: true }).click();
    await expect(table.pages[0]!.getByRole('status').filter({ hasText: '蓮さんの判断を待っています' })).toBeVisible();
    await expect(table.pages[2]!.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
  } finally { await table.close(); }
});

test('an ACK lost after commit is replayed with the exact same command after reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request);
  try {
    const owner = table.pages[0]!; let dropped = false;
    const sent: string[] = []; const acknowledgements: { commandId: string; revision: number }[] = [];
    await owner.routeWebSocket('**/api/rooms/*/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => { sent.push(String(message)); server.send(message); });
      server.onMessage(message => {
        const parsed = JSON.parse(String(message));
        if (parsed.type === 'ack') { acknowledgements.push(parsed); if (!dropped) { dropped = true; return; } }
        route.send(message);
      });
    });
    await owner.goto(table.url);
    await owner.getByRole('button', { name: '準備完了', exact: true }).click();
    await expect.poll(() => dropped).toBe(true);
    await owner.reload();
    await expect(owner.getByRole('button', { name: '準備を取り消す', exact: true })).toBeEnabled();
    expect(sent).toHaveLength(2); expect(sent[1]).toBe(sent[0]);
    expect(acknowledgements).toHaveLength(2); expect(acknowledgements[1]).toEqual(acknowledgements[0]);
  } finally { await table.close(); }
});

test('a second tab has the active seat while the first tab stays read-only', async ({ browser, request }) => {
  const table = await tableFixture(browser, request);
  try {
    const old = table.pages[0]!; await old.goto(table.url);
    await expect(old.getByRole('button', { name: '準備完了', exact: true })).toBeEnabled();
    const next = await table.contexts[0]!.newPage(); await next.goto(table.url);
    await expect(next.getByRole('button', { name: '準備完了', exact: true })).toBeEnabled();
    await expect(old.getByRole('status').filter({ hasText: '閲覧のみ' })).toBeVisible();
    await expect(old.getByRole('button', { name: '準備完了', exact: true })).toBeDisabled();
    await next.getByRole('button', { name: '準備完了', exact: true }).click();
    await expect(old.getByRole('button', { name: '準備を取り消す', exact: true })).toBeDisabled();
  } finally { await table.close(); }
});
