import { test, expect } from '@playwright/test';
import { getAction } from '../../packages/catalog/src/index.js';
import { choose, legalCommands } from '../../packages/engine/src/bot/index.js';
import { origin, tableFixture } from './helpers.js';
import { BotClient } from './bot-client.js';

for (const count of [4]) {
  test(`${count} seats start through the normal API and play to an outcome with fixed entropy`, async ({ browser, request }) => {
    test.setTimeout(20 * 60 * 1000);
    const table = await tableFixture(browser, request, undefined, count);
    try {
      expect((await request.post(`/__test/rooms/${table.roomId}/entropy`, { data: { seed: count } })).status()).toBe(204);
      for (const page of table.pages) {
        await page.goto(table.url);
        await page.getByRole('button', { name: '準備完了', exact: true }).click();
      }
      await table.pages[0]!.getByRole('button', { name: '対戦を始める', exact: true }).click();
      for (const page of table.pages) await expect(page.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
      const bots = await Promise.all(table.contexts.map(async context => {
        const cookie = (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; ');
        const bot = new BotClient(origin, cookie, table.roomId);
        await bot.connect();
        return bot;
      }));
      let steps = 0;
      while (steps < 5000) {
        const views = bots.map(bot => bot.view());
        if (views[0]?.outcome) break;
        let acted = false;
        for (const [index, bot] of bots.entries()) {
          const view = views[index];
          if (!view || legalCommands(view).length === 0) continue;
          const result = await bot.send(choose(view, count));
          expect(result.ok, `seat ${index} step ${steps} ${result.code}`).toBe(true);
          acted = true;
          steps++;
          break;
        }
        if (!acted) await new Promise(resolve => setTimeout(resolve, 50));
      }
      expect(bots[0]!.view()?.outcome).toBeDefined();
      for (const [index, page] of table.pages.entries()) {
        await page.reload();
        await expect(page.getByRole('status', { name: '対戦結果' })).toBeVisible();
        // 決着後の全公開: the screen has never shown another seat's hand before this point, so the panel and
        // a card only the reveal can name are checked together; nothing else in this suite reaches it.
        const view = bots[index]!.view()!;
        const reveal = page.getByRole('region', { name: '全員の手の内' });
        await expect(reveal).toBeVisible();
        const opened = view.seatOrder.filter(id => id !== view.self.id).flatMap(id => view.reveal!.players[id]!.hand);
        expect(opened.length, 'a decided game still leaves cards in somebody else’s hand').toBeGreaterThan(0);
        await expect(reveal.getByRole('button', { name: `${getAction(opened[0]!)!.name}の詳細を見る` }).first()).toBeVisible();
      }
      const stale = await bots[0]!.send({ type: 'END_TURN', discardIds: [] });
      expect(stale.ok).toBe(false);
      bots.forEach(bot => bot.close());
    } finally { await table.close(); }
  });
}
