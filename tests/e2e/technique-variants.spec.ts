import { currentCardAction } from './helpers.js';
import { test, expect } from '@playwright/test';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { tableFixture } from './helpers.js';

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

async function passToDefense(table: Table, views: Map<string, RoomView>) {
  const owner = table.sessions[0]!.id;
  for (let step = 0; step < 64; step++) {
    const current = views.get(owner)!;
    if (current.game!.activeWindow?.kind === 'normal-defense') return current.game!;
    const window = current.game!.activeWindow!;
    expect(window).not.toBeNull();
    const page = table.pages[table.sessions.findIndex(session => session.id === window.pendingActorId)]!;
    await page.getByRole('button', { name: 'パス', exact: true }).click();
    await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(current.revision);
  }
  throw Error('Expected normal defense within the bounded real UI decisions');
}

test('Lancaster can select a dedicated one-hit lance attack', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lance-variant-ready');
  try {
    const views = await observe(table); const page = table.pages[0]!;
    await page.getByRole('region', { name: '自分の手札' }).getByRole('button', { name: '連槍撃', exact: true }).click();
    const variants = page.getByRole('combobox', { name: '専用効果の選択', exact: true });
    await expect(variants).toHaveCount(0);
    await page.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
    await expect(variants).toHaveValue('two-hit'); await variants.selectOption('one-hit');
    await page.getByRole('article').filter({ has: page.getByRole('heading', { name: '楓', exact: true }) }).getByRole('checkbox').check();
    await page.getByRole('button', { name: '攻撃を確認して実行', exact: true }).click();
    await expect.poll(() => currentCardAction(views.get(table.sessions[0]!.id)?.game)?.cardInstanceId).toBe('a2-p10-r3c2');
    const game = await passToDefense(table, views);
    expect(currentCardAction(game)!.technique).toMatchObject({ effectLevel: 5, damage: 7, hitCount: 1 });
    expect(game.currentAttack!.targets[0]!.hits).toHaveLength(1);
  } finally { await table.close(); }
});

test('Lancelot II can select his inherited chanted technique package', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lancelot-variant-ready');
  try {
    const views = await observe(table); const page = table.pages[0]!;
    const chants = page.getByRole('region', { name: '自分の詠唱' });
    await chants.getByRole('button', { name: '光竜破山剣を選ぶ', exact: true }).click();
    await page.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
    const variants = page.getByRole('combobox', { name: '専用効果の選択', exact: true });
    await expect(variants).toHaveValue('lancelot-2'); await variants.selectOption('lancelot-1');
    await page.getByRole('article').filter({ has: page.getByRole('heading', { name: '楓', exact: true }) }).getByRole('checkbox').check();
    await page.getByRole('button', { name: '攻撃を確認して実行', exact: true }).click();
    await expect(chants.getByRole('button', { name: '光竜破山剣を選ぶ', exact: true })).toHaveCount(0);
    const game = await passToDefense(table, views);
    expect(currentCardAction(game)!.technique.effectLevel).toBe(8);
    expect(currentCardAction(game)!.technique.damage).toBeGreaterThanOrEqual(5);
    expect(currentCardAction(game)!.technique.damage).toBeLessThanOrEqual(25);
  } finally { await table.close(); }
});

test('Shin can choose his dedicated counter from the chant zone', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'dedicated-chant-defense');
  try {
    const views = await observe(table); const page = table.pages[1]!;
    const decision = page.getByRole('complementary', { name: '現在の判断' });
    const card = decision.getByRole('combobox', { name: '使うカード', exact: true });
    await expect(card.locator('option[value="a2-p10-r2c1"]')).toHaveCount(1);
    await card.selectOption('a2-p10-r2c1');
    await expect(decision.getByRole('checkbox', { name: /ツバメ返し/ })).not.toBeChecked();
    await expect(decision.getByRole('button', { name: '防御する', exact: true })).toBeDisabled();
    await decision.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
    await expect(decision.getByRole('button', { name: '防御する', exact: true })).toBeEnabled();
    await decision.getByRole('button', { name: '防御する', exact: true }).click();
    const id = table.sessions[1]!.id;
    await expect.poll(() => currentCardAction(views.get(id)?.game)?.cardInstanceId).toBe('a2-p10-r2c1');
    expect(views.get(id)!.game!.self.chants.some(chant => chant.cardInstanceId === 'a2-p10-r2c1')).toBe(false);
  } finally { await table.close(); }
});
