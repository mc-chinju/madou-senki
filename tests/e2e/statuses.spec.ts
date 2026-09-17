import { currentCardAction } from './helpers.js';
import { test, expect } from '@playwright/test';
import { observe, passUntil, storedDiscard, tableFixture } from './helpers.js';

test('a persisted stop explains the limitation and keeps follower defense available', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'stopped-defense');
  try {
    const views = await observe(table); const defender = table.sessions[1]!.id; const page = table.pages[1]!;
    const status = views.get(defender)!.game!.players[defender]!.statuses[0]!;
    expect(status).toMatchObject({ kind: 'stopped', sourceCardInstanceId: 'a2-p15-r2c2', recoveryModifier: -1 });
    const region = page.getByRole('region', { name: '楓の状態異常', exact: true });
    await expect(region).toContainText('停止（悪夢）');
    await expect(region).toContainText('正体の公開と従者による防御はできます');
    await expect(table.pages[0]!.getByRole('region', { name: '楓の状態異常', exact: true })).toContainText('停止（悪夢）');
    await page.reload(); await expect(region).toContainText('次の回復判定: 精神力−1');
    expect(views.get(defender)!.game!.players[defender]!.statuses[0]).toEqual(status);
    const decision = page.getByRole('complementary', { name: '現在の判断' });
    await expect(decision.getByRole('combobox', { name: '使うカード', exact: true })).toHaveCount(0);
    await expect(decision.getByRole('button', { name: '防御する', exact: true })).toHaveCount(0);
    await expect(decision.getByRole('button', { name: '間合いを使う', exact: true })).toHaveCount(0);
    await decision.getByRole('button', { name: '従者で受ける', exact: true }).click();
    await expect.poll(() => views.get(defender)?.game?.activeWindow?.kind).not.toBe('normal-defense');
    const completed = await passUntil(table, views, game => !game.activeWindow && game.phase === 'withdrawal');
    expect(completed.players[defender]!.statuses[0]).toEqual(status);
  } finally { await table.close(); }
});

test('ability suppression leaves a character-specific card defense usable', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'ability-disabled-defense');
  try {
    const views = await observe(table); const defender = table.sessions[1]!.id; const page = table.pages[1]!;
    const own = views.get(defender)!.game!;
    expect(own.players[defender]!.statuses[0]).toMatchObject({ kind: 'ability-disabled', sourceCardInstanceId: 'a2-p13-r1c2' });
    await expect(page.getByRole('region', { name: '楓の状態異常', exact: true })).toContainText('カードに書かれた専用効果は使えます');
    const decision = page.getByRole('complementary', { name: '現在の判断' });
    await decision.getByRole('checkbox', { name: '専用技として使う' }).check();
    await decision.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p14-r1c2');
    await decision.getByRole('button', { name: '防御する', exact: true }).click();
    await expect.poll(() => views.get(defender)?.game?.self.hand.includes('a2-p14-r1c2')).toBe(false);
    await expect.poll(() => currentCardAction(views.get(defender)?.game)?.cardInstanceId).toBe('a2-p14-r1c2');
    await page.reload();
    await expect(page.getByRole('region', { name: '楓の状態異常', exact: true })).toContainText('特殊能力無効');
    const ended = await passUntil(table, views, game => !game.activeWindow && game.phase === 'withdrawal');
    expect(ended.players[defender]!.damage).toBe(0);
    expect(ended.players[defender]!.statuses).toHaveLength(1);
  } finally { await table.close(); }
});

test('nightmare sums two dice before multiplying by two and rerolls both dice', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'nightmare-damage');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const page = table.pages[0]!;
    const original = views.get(owner)!.game!.currentRoll!;
    expect(original).toMatchObject({ kind: 'numeric', formula: '2d6x2', faces: [1, 1], total: 4 });
    const result = page.getByRole('region', { name: 'サイコロの結果', exact: true });
    await expect(result).toContainText('(1 + 1) × 2 = 4');
    const decision = page.getByRole('complementary', { name: '現在の判断' });
    await decision.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r1c3');
    await decision.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.self.hand.includes('a2-p02-r1c3')).toBe(false);
    const rerolled = await passUntil(table, views, game => game.currentRoll?.rollId === original.rollId && game.currentRoll.generation === 1 && game.activeWindow?.kind === 'after-roll');
    const roll = rerolled.currentRoll!;
    expect(roll.faces).toHaveLength(2); expect(roll.total).toBe((roll.faces[0]! + roll.faces[1]!) * 2);
    await expect(result).toContainText(`(${roll.faces[0]} + ${roll.faces[1]}) × 2 = ${roll.total}`);
    await result.locator('summary').click();
    await expect(result.getByText('最初: (1 + 1) × 2 = 4', { exact: true })).toBeVisible();
  } finally { await table.close(); }
});


test('a concealed stopped player can reveal without losing the follower-defense decision', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'stopped-reveal');
  try {
    const views = await observe(table); const defender = table.sessions[1]!.id; const owner = table.sessions[0]!.id;
    const page = table.pages[1]!;
    const before = views.get(owner)!.game!;
    expect(before.players[defender]!.revealed).toBe(false);
    expect(before.players[defender]!.characterId).toBeUndefined();
    const status = before.players[defender]!.statuses;
    expect(status[0]?.kind).toBe('stopped');
    const windowId = before.activeWindow!.windowId;
    await page.getByRole('button', { name: '正体を公開', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.players[defender]?.revealed).toBe(true);
    await expect(table.pages[0]!.getByRole('button', { name: '黒騎士ガーウィンの人物カードを見る', exact: true })).toBeVisible();
    expect(views.get(owner)!.game!.players[defender]!.statuses).toEqual(status);
    expect(views.get(owner)!.game!.activeWindow!.windowId).toBe(windowId);
    await page.getByRole('button', { name: '従者で受ける', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.activeWindow?.kind).not.toBe('normal-defense');
  } finally { await table.close(); }
});

test('silence blocks new magic chants while a warrior chant remains playable', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'silenced-chant');
  try {
    const views = await observe(table); const owner = table.sessions[1]!.id; const page = table.pages[1]!;
    expect(views.get(owner)!.game!.players[owner]!.statuses[0]).toMatchObject({ kind: 'silenced', sourceCardInstanceId: 'a2-p18-r1c1' });
    await expect(page.getByRole('region', { name: '楓の状態異常', exact: true })).toContainText('魔法技の使用と魔法技の新規詠唱はできません');
    const hand = page.getByRole('region', { name: '自分の手札', exact: true });
    const magic = hand.getByRole('button', { name: '氷狼乱舞陣', exact: true });
    const chant = page.getByRole('button', { name: '詠唱', exact: true });
    await magic.click(); await expect(chant).toBeDisabled();
    await expect(page.getByRole('region', { name: '操作の確認', exact: true })).toContainText('沈黙中はこの魔法技の攻撃・新規詠唱はできません');
    await magic.click();
    await hand.getByRole('button', { name: '天地百撃斬', exact: true }).click();
    await expect(chant).toBeEnabled(); await chant.click();
    await expect.poll(() => views.get(owner)?.game?.self.chants.some(card => card.cardInstanceId === 'a2-p10-r1c3')).toBe(true);
    expect(views.get(owner)!.game!.players[owner]!.statuses[0]?.kind).toBe('silenced');
  } finally { await table.close(); }
});


test('a reflected stop finishes the turn without refill and lets the next player start', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'reflected-stop-withdrawal');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const page = table.pages[0]!;
    const before = views.get(owner)!.game!;
    const discardBefore = await storedDiscard();
    expect(before.phase).toBe('withdrawal'); expect(before.self.hand.length).toBeLessThan(before.self.stats.handLimit);
    expect(before.players[owner]!.statuses[0]?.kind).toBe('stopped');
    await expect(page.getByRole('button', { name: '離脱', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '離脱しない', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.turnSeat).toBe(1);
    const after = views.get(owner)!.game!;
    expect(after.phase).toBe('turn-start'); expect(after.self.hand).toEqual(before.self.hand);
    expect(after.deckCount).toBe(before.deckCount); expect(after.discardCount).toBe(before.discardCount); expect(await storedDiscard()).toEqual(discardBefore);
    expect(after.players[owner]!.statuses).toEqual(before.players[owner]!.statuses);
    await table.pages[1]!.getByRole('button', { name: '手番を始める', exact: true }).click();
    await expect(table.pages[1]!.getByRole('button', { name: 'カードを引く', exact: true })).toBeEnabled();
  } finally { await table.close(); }
});
