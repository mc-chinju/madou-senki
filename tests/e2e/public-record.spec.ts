import { test, expect } from '@playwright/test';
import type { GameState, PlayerView } from '../../packages/engine/src/index.js';
import { choose, legalCommands } from '../../packages/engine/src/bot/index.js';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { origin, tableFixture } from './helpers.js';
import { BotClient } from './bot-client.js';

/** Card and character ids the viewer must not receive at this saved revision. */
function secretsFor(game: GameState, viewerId: string): string[] {
  const shown = new Set(game.events.filter(event => event.audience === 'public').flatMap(event => [event.cardInstanceId, event.death?.sourceCardInstanceId]));
  const others = game.seatOrder.filter(id => id !== viewerId).map(id => game.players[id]!);
  return [
    ...game.discard.filter(id => !shown.has(id)),
    ...others.flatMap(p => [...p.hand, ...[...p.followers, ...p.chants].filter(card => !card.revealed).map(card => card.cardInstanceId)]),
    ...others.filter(p => !p.revealed).map(p => p.characterId),
  ];
}

test('another seat can trace the whole bot game in the public record while its socket never carries secrets', async ({ browser, request }) => {
  test.setTimeout(20 * 60 * 1000);
  const table = await tableFixture(browser, request, undefined, 4);
  try {
    expect((await request.post(`/__test/rooms/${table.roomId}/entropy`, { data: { seed: 4 } })).status()).toBe(204);
    const watcher = table.pages[1]!, watcherId = table.sessions[1]!.id;
    const frames: string[] = [];
    let latest: RoomView | null = null;
    watcher.on('websocket', socket => socket.on('framereceived', frame => {
      const text = String(frame.payload), message = JSON.parse(text);
      if (message.type === 'snapshot') { frames.push(text); latest = message.view; }
    }));
    for (const page of table.pages) {
      await page.goto(table.url);
      await page.getByRole('button', { name: '準備完了', exact: true }).click();
    }
    await table.pages[0]!.getByRole('button', { name: '対戦を始める', exact: true }).click();
    for (const page of table.pages) await expect(page.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
    const bots = await Promise.all(table.contexts.map(async context => {
      const bot = new BotClient(origin, (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; '), table.roomId);
      await bot.connect();
      return bot;
    }));
    let steps = 0, audits = 0;
    const audit = async () => {
      const game = await (await request.get(`/__test/rooms/${table.roomId}/game`)).json() as GameState;
      await expect.poll(() => (latest as RoomView | null)?.game?.revision).toBe(game.revision);
      const frame = frames.at(-1)!;
      expect(JSON.parse(frame).view.game).not.toHaveProperty('discard');
      expect((latest as RoomView | null)!.game!.discardCount).toBe(game.discard.length);
      for (const secret of secretsFor(game, watcherId)) expect(frame, `revision ${game.revision}`).not.toContain(`"${secret}"`);
      audits++;
    };
    while (steps < 5000) {
      const views = bots.map(bot => bot.view());
      if (views[0]?.outcome) break;
      let acted = false;
      for (const [index, bot] of bots.entries()) {
        const view = views[index] as PlayerView | null;
        if (!view || legalCommands(view).length === 0) continue;
        const result = await bot.send(choose(view, 4));
        expect(result.ok, `seat ${index} step ${steps} ${result.code}`).toBe(true);
        acted = true; steps++;
        if (steps % 40 === 0) await audit();
        break;
      }
      if (!acted) await new Promise(resolve => setTimeout(resolve, 50));
    }
    expect(bots[0]!.view()?.outcome).toBeDefined();
    await audit();
    // audit() runs every 40 steps and once more after the outcome, so the count follows the bot game's length.
    expect(audits).toBe(Math.floor(steps / 40) + 1);
    expect(audits).toBeGreaterThanOrEqual(2);
    bots.forEach(bot => bot.close());

    await watcher.reload();
    const record = watcher.getByRole('region', { name: '戦記の全件' });
    await record.evaluate(element => { element.scrollTop = 0; });
    await expect(watcher.getByRole('button', { name: '最新へ', exact: true })).toBeVisible();
    const firstTurn = record.getByRole('region', { name: /^1手番 / });
    await firstTurn.scrollIntoViewIfNeeded();
    await expect(firstTurn).toBeVisible();
    // L1: an attack names the seat it points at and closes with how it ended; L2 keeps the roll's outcome on the line.
    for (const text of [/さんへ攻撃を宣言しました/, /への攻撃(が命中しました|は防がれました|は不発に終わりました|は無効化されました)/, /を出しました/, /ダメージを受けました/, /でパスしました/]) await expect(record.getByText(text).first()).toBeAttached();
    await watcher.screenshot({ path: '.cache/e2e-results/public-record-first-turn.png', fullPage: false });
    await watcher.getByRole('button', { name: '最新へ', exact: true }).click();
    await expect(watcher.getByRole('button', { name: '最新へ', exact: true })).toHaveCount(0);
  } finally { await table.close(); }
});
