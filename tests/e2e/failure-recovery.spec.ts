import { test, expect } from '@playwright/test';
import { choose, legalCommands } from '../../packages/engine/src/bot/index.js';
import { origin, tableFixture } from './helpers.js';
import { BotClient } from './bot-client.js';

async function connectBots(contexts: Awaited<ReturnType<typeof tableFixture>>['contexts'], roomId: string) {
  return Promise.all(contexts.map(async context => {
    const cookie = (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; ');
    const bot = new BotClient(origin, cookie, roomId);
    await bot.connect();
    return bot;
  }));
}

async function playSteps(bots: BotClient[], seed: number, maxSteps: number) {
  let steps = 0;
  let lastIndex = -1;
  while (steps < maxSteps) {
    const views = bots.map(bot => bot.view());
    if (views[0]?.outcome) break;
    let acted = false;
    for (const [index, bot] of bots.entries()) {
      const view = views[index];
      if (!view || legalCommands(view).length === 0) continue;
      const result = await bot.send(choose(view, seed));
      expect(result.ok, `seat ${index} step ${steps} ${result.code}`).toBe(true);
      acted = true;
      lastIndex = index;
      steps++;
      break;
    }
    if (!acted) await new Promise(resolve => setTimeout(resolve, 50));
  }
  return { steps, lastIndex };
}

test('all seats disconnect mid-game, the table survives, and an unacknowledged command is not applied twice', async ({ browser, request }) => {
  test.setTimeout(20 * 60 * 1000);
  const table = await tableFixture(browser, request, undefined, 4);
  const cookies = await Promise.all(table.contexts.map(context => context.cookies()));
  const { roomId, url } = table;
  try {
    expect((await request.post(`/__test/rooms/${roomId}/entropy`, { data: { seed: 4 } })).status()).toBe(204);
    for (const page of table.pages) {
      await page.goto(table.url);
      await page.getByRole('button', { name: '準備完了', exact: true }).click();
    }
    await table.pages[0]!.getByRole('button', { name: '対戦を始める', exact: true }).click();
    for (const page of table.pages) await expect(page.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
    let bots = await connectBots(table.contexts, roomId);
    const played = await playSteps(bots, 4, 50);
    expect(played.lastIndex).toBeGreaterThanOrEqual(0);
    const revision = bots[0]!.revision();
    const replay = bots[played.lastIndex]!.payload();
    const committedRevision = (JSON.parse(replay!) as { expectedRevision: number }).expectedRevision + 1;
    expect(revision).toBeGreaterThan(0);
    expect(replay).toBeTruthy();
    bots.forEach(bot => bot.close());
    await table.close();

    const contexts = await Promise.all(cookies.map(async jar => {
      const context = await browser.newContext({ baseURL: origin });
      await context.addCookies(jar);
      return context;
    }));
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    try {
      for (const page of pages) {
        await page.goto(url);
        await expect(page.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
      }
      bots = await connectBots(contexts, roomId);
      expect(bots[0]!.revision()).toBe(revision);
      const before = await (await request.get(`/__test/rooms/${roomId}/game`)).json();
      const replayed = await bots[played.lastIndex]!.sendPayload(replay!);
      expect(replayed).toMatchObject({ ok: true, revision: committedRevision });
      expect(await (await request.get(`/__test/rooms/${roomId}/game`)).json()).toEqual(before);

      await playSteps(bots, 4, 5000);
      expect(bots[0]!.view()?.outcome).toBeDefined();
      bots.forEach(bot => bot.close());
      for (const page of pages) {
        await page.reload();
        await expect(page.getByRole('status', { name: '対戦結果' })).toBeVisible();
        await page.getByRole('button', { name: '閉卓に同意する', exact: true }).click();
      }
      await pages[0]!.goto('/');
      await expect.poll(async () => {
        const listed = await pages[0]!.evaluate(async () => (await fetch('/api/rooms')).json() as Promise<{ rooms: { roomId: string }[] }>);
        return listed.rooms.some(room => room.roomId === roomId);
      }).toBe(false);
    } finally {
      await Promise.all(contexts.map(context => context.close()));
    }
  } catch (error) {
    await table.close().catch(() => undefined);
    throw error;
  }
});
