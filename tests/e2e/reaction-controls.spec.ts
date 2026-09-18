import { currentCardAction } from './helpers.js';
import { test, expect } from '@playwright/test';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { tableFixture } from './helpers.js';

test('defender can explicitly choose the dedicated counter effect', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'dedicated-defense');
  try {
    const views = new Map<string, RoomView>();
    for (const [index, page] of table.pages.entries()) {
      page.on('websocket', socket => socket.on('framereceived', frame => {
        const message = JSON.parse(String(frame.payload));
        if (message.type === 'snapshot') views.set(table.sessions[index]!.id, message.view);
      }));
      await page.goto(table.url);
      await expect(page.getByRole('region', { name: '自分の手札' })).toBeVisible();
    }
    const defender = table.pages[1]!; const defenderId = table.sessions[1]!.id;
    const decision = defender.getByRole('complementary', { name: '現在の判断' });
    const dedicated = decision.getByRole('checkbox', { name: '専用技として使う', exact: true });
    await expect(dedicated).not.toBeChecked();
    await dedicated.check();
    await decision.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p08-r2c3');
    await decision.getByRole('button', { name: '防御する', exact: true }).click();
    await expect.poll(() => currentCardAction(views.get(defenderId)?.game)?.cardInstanceId).toBe('a2-p08-r2c3');
    expect(views.get(defenderId)!.game!.self.hand).not.toContain('a2-p08-r2c3');
    // The server only publishes final effect level when the effect window closes.
    for (let step = 0; step < 16 && currentCardAction(views.get(defenderId)?.game)?.technique.effectLevel === undefined; step++) {
      const current = views.get(defenderId)!;
      const window = current.game!.activeWindow!;
      const page = table.pages[table.sessions.findIndex(session => session.id === window.pendingActorId)]!;
      await page.getByRole('button', { name: 'パス', exact: true }).click();
      await expect.poll(() => views.get(defenderId)?.revision).toBeGreaterThan(current.revision);
    }
    expect(currentCardAction(views.get(defenderId)!.game)!.technique.effectLevel).toBe(6);
  } finally { await table.close(); }
});

