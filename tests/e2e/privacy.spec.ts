import { test, expect } from '@playwright/test';
import { tableFixture } from './helpers.js';

test('four browser views and JSON/WS bodies exclude the other seats’ concealed identities and cards', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'setup');
  try {
    for (const [index, page] of table.pages.entries()) {
      const messages: string[] = []; const bodies: Promise<string>[] = [];
      page.on('websocket', socket => { socket.on('framereceived', frame => { messages.push(String(frame.payload)); }); });
      page.on('response', response => { if (response.url().includes('/api/') && response.headers()['content-type']?.includes('application/json')) bodies.push(response.text()); });
      await page.goto(table.url); await expect(page.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
      await expect.poll(() => messages.length).toBeGreaterThan(0);
      const owner = table.sessions[index]!.id;
      const others = Object.values(table.expected!.players).filter(player => player.id !== owner);
      // A character can be named in my own protection without identifying another seat.
      // Validate that exact private field, then retain the broad leak check everywhere else.
      const checkedBody = (body: string) => {
        const parsed = JSON.parse(body);
        const view = parsed.type === 'snapshot' ? parsed.view : parsed;
        if (view.game) {
          expect(view.game.self.id).toBe(owner);
          expect(view.game.self.protection).toEqual(table.expected!.players[owner]!.protection);
          for (const other of others) {
            expect(view.game.players[other.id].revealed).toBe(false);
            for (const key of ['characterId', 'faction', 'hand', 'objective', 'currentObjective', 'protection', 'defeatCondition']) {
              expect(view.game.players[other.id]).not.toHaveProperty(key);
            }
          }
          view.game.self.protection.characterIds = [];
        }
        return JSON.stringify(parsed);
      };
      expect(messages.some(body => JSON.parse(body).type === 'snapshot')).toBe(true);
      const serialized = messages.map(checkedBody).join('\n')
        + (await Promise.all(bodies)).map(checkedBody).join('\n') + await page.content();
      expect(serialized).toContain(table.expected!.players[owner]!.characterId);
      for (const player of others) {
        expect(serialized).not.toContain(player.characterId);
        for (const id of player.hand) expect(serialized).not.toContain(id);
      }
    }
  } finally { await table.close(); }
});

test('card inspection works by keyboard and touch and fits a phone viewport', async ({ browser, request }, testInfo) => {
  const table = await tableFixture(browser, request, 'setup', 4, { hasTouch: true });
  try {
    const page = table.pages[0]!; await page.goto(table.url);
    const detail = page.getByRole('region', { name: '自分の手札' }).getByRole('button', { name: /の詳細を見る/ }).first();
    await detail.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
    await expect(detail).toBeFocused();
    const thumbnail = page.getByRole('region', { name: '自分の手札' }).locator('.card-face img').first();
    await expect.poll(() => thumbnail.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const ratios = await thumbnail.evaluate(image => {
      const img = image as HTMLImageElement; const box = img.getBoundingClientRect();
      return { rendered: box.width / box.height, source: img.naturalWidth / img.naturalHeight };
    });
    expect(ratios.rendered).toBeCloseTo(ratios.source, 2);
    await page.screenshot({ path: testInfo.outputPath('board-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await detail.tap(); await expect(page.getByRole('dialog')).toBeVisible();
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(390); expect(bounds!.height).toBeLessThanOrEqual(844);
    await page.screenshot({ path: testInfo.outputPath('card-phone.png'), fullPage: true });
    await page.getByRole('button', { name: 'カード詳細を閉じる', exact: true }).tap();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await table.close(); }
});
