import { currentCardAction } from './helpers.js';
import { test, expect } from '@playwright/test';
import type { PlayerView } from '../../packages/engine/src/index.js';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { tableFixture, windowPassButtonName } from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
async function observe(table: Table) {
  const views = new Map<string, RoomView>();
  for (const [index, page] of table.pages.entries()) {
    page.on('websocket', socket => socket.on('framereceived', frame => {
      const message = JSON.parse(String(frame.payload));
      if (message.type === 'snapshot') views.set(table.sessions[index]!.id, message.view);
    }));
    await page.goto(table.url);
    await expect(page.getByRole('region', { name: '自分の手札' })).toBeVisible();
  }
  return views;
}

async function passUntil(table: Table, views: Map<string, RoomView>, done: (game: PlayerView) => boolean) {
  const owner = table.sessions[0]!.id;
  for (let step = 0; step < 64; step++) {
    const current = views.get(owner)!; const game = current.game!;
    if (done(game)) return game;
    const window = game.activeWindow; expect(window).not.toBeNull();
    const page = table.pages[table.sessions.findIndex(session => session.id === window!.pendingActorId)]!;
    await page.getByRole('button', { name: windowPassButtonName }).click();
    await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(current.revision);
  }
  throw Error('Magic effect did not reach its expected boundary');
}

test('Ice Flow makes a separate optional follower decision for each target and survives reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'magic-bypass');
  try {
    const views = await observe(table); const page = table.pages[0]!;
    const [owner, first, second] = table.sessions.map(session => session.id) as [string, string, string];
    const decision = page.getByRole('complementary', { name: '現在の判断' });
    await expect(decision).toContainText('対象: 楓');
    const before = views.get(owner)!.revision;
    await decision.getByRole('button', { name: '条件を満たす従者を無視する', exact: true }).click();
    await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(before);
    await passUntil(table, views, game => game.activeWindow?.kind === 'follower-bypass-choice' && game.currentAttack?.targetId === second);
    expect(views.get(owner)!.game!.players[first]!.followers).toEqual([{ position: 0, face: 'back' }]);
    await page.reload();
    await expect(decision).toContainText('対象: 凛');
    await decision.getByRole('button', { name: '無視しない', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.activeWindow?.kind).not.toBe('follower-bypass-choice');
    const game = await passUntil(table, views, current => current.phase === 'withdrawal' && !current.activeWindow);
    expect(game.players[first]!.damage).toBe(6);
    expect(game.players[first]!.followers).toEqual([{ position: 0, face: 'back' }]);
    expect(game.players[second]!.damage).toBe(5);
    expect(game.players[second]!.followers).toEqual([]);
  } finally { await table.close(); }
});

test('Shelim can explicitly select White Light as a dedicated defense', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'magic-dedicated-defense');
  try {
    const views = await observe(table); const page = table.pages[1]!; const id = table.sessions[1]!.id;
    const decision = page.getByRole('complementary', { name: '現在の判断' });
    const card = decision.getByRole('combobox', { name: '使うカード', exact: true });
    await expect(card.locator('option[value="a2-p14-r1c2"]')).toHaveCount(0);
    await decision.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
    await card.selectOption('a2-p14-r1c2');
    await decision.getByRole('button', { name: '防御する', exact: true }).click();
    await expect.poll(() => currentCardAction(views.get(id)?.game)?.cardInstanceId).toBe('a2-p14-r1c2');
    expect(views.get(id)!.game!.self.hand).not.toContain('a2-p14-r1c2');
  } finally { await table.close(); }
});


test('a dedicated curse song shows public defense restrictions and keeps teleport usable', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'magic-restricted-defense');
  try {
    const views = await observe(table); const page = table.pages[1]!; const id = table.sessions[1]!.id;
    const decision = page.getByRole('complementary', { name: '現在の判断' });
    await expect(decision).toContainText('見切り不可・反撃不可');
    const card = decision.getByRole('combobox', { name: '使うカード', exact: true });
    await expect(card.locator('option[value="a2-p05-r3c1"]')).toHaveCount(0);
    await expect(card.locator('option[value="a2-p08-r2c3"]')).toHaveCount(0);
    await decision.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
    await expect(card.locator('option[value="a2-p14-r1c2"]')).toHaveCount(0);
    await decision.getByRole('checkbox', { name: '専用技として使う', exact: true }).uncheck();
    await card.selectOption('a2-p06-r1c1');
    await decision.getByRole('button', { name: '防御する', exact: true }).click();
    await expect.poll(() => currentCardAction(views.get(id)?.game)?.cardInstanceId).toBe('a2-p06-r1c1');
    expect(views.get(id)!.game!.self.hand).not.toContain('a2-p06-r1c1');
  } finally { await table.close(); }
});
