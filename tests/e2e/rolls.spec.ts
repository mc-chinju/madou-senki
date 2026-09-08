import { test, expect } from '@playwright/test';
import { tableFixture, observe, passUntil } from './helpers.js';

test('a roll can be rerolled after reload without revealing another player’s threshold', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'roll-check');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const page = table.pages[0]!;
    const original = views.get(owner)!.game!.currentRoll!;
    expect(original.faces).toEqual([6, 6]); expect(original.threshold).toBe(8);
    const roll = page.getByRole('region', { name: 'サイコロの結果', exact: true });
    await expect(roll).toContainText('6 + 6 = 12');
    await expect(roll).toContainText('判定値: 8以下');
    for (const session of table.sessions.slice(1)) {
      const other = views.get(session.id)!.game!.currentRoll!;
      expect(other.threshold).toBeUndefined(); expect(other.success).toBeUndefined();
      expect(other.attempts.every(attempt => attempt.success === undefined)).toBe(true);
    }
    await expect(table.pages[1]!.getByRole('region', { name: 'サイコロの結果', exact: true })).not.toContainText('判定値:');
    const decision = page.getByRole('complementary', { name: '現在の判断' });
    await decision.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption('reroll');
    await decision.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r1c3');
    await decision.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.self.hand.includes('a2-p02-r1c3')).toBe(false);
    const saved = views.get(owner)!; await page.reload();
    await expect(page.getByRole('region', { name: '自分の手札' })).toBeVisible();
    expect(views.get(owner)!.revision).toBe(saved.revision);
    const game = await passUntil(table, views, current => current.activeWindow?.kind === 'after-roll' && current.currentRoll?.rollId === original.rollId && current.currentRoll.generation === 1);
    expect(game.currentRoll!.attempts).toHaveLength(2);
    expect(game.currentRoll!.faces).toHaveLength(2);
    expect(game.currentRoll!.total).toBe(game.currentRoll!.faces.reduce((sum, face) => sum + face, 0));
    expect(game.currentRoll!.threshold).toBe(8);
    expect(game.self.stats.spirit).toBeGreaterThan(8);
    await expect(roll).toContainText('振り直し 1回');
  } finally { await table.close(); }
});

test('forced failure remains visible after a reroll and survives completed-action reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'roll-check');
  try {
    const views = await observe(table); const [owner, , third] = table.sessions.map(session => session.id) as [string, string, string];
    const rollId = views.get(owner)!.game!.currentRoll!.rollId;
    await passUntil(table, views, game => game.activeWindow?.pendingActorId === third);
    const thirdDecision = table.pages[2]!.getByRole('complementary', { name: '現在の判断' });
    await thirdDecision.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption('force-fail');
    await thirdDecision.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await thirdDecision.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.activeWindow?.kind).toBe('declaration');
    await passUntil(table, views, game => game.currentRoll?.forcedFailure === true && game.activeWindow?.kind === 'after-roll');
    const decision = table.pages[0]!.getByRole('complementary', { name: '現在の判断' });
    await decision.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption('reroll');
    await decision.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r1c3');
    await decision.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.self.hand.includes('a2-p02-r1c3')).toBe(false);
    const rerolled = await passUntil(table, views, game => game.currentRoll?.generation === 1 && game.activeWindow?.kind === 'after-roll');
    expect(rerolled.currentRoll!.forcedFailure).toBe(true); expect(rerolled.currentRoll!.success).toBe(false);
    await expect(table.pages[0]!.getByRole('region', { name: 'サイコロの結果', exact: true })).toContainText('強制失敗');
    const ended = await passUntil(table, views, game => !game.activeWindow && game.phase === 'withdrawal');
    const record = ended.recentRolls.find(roll => roll.rollId === rollId)!;
    expect(record.stage).toBe('applied'); expect(record.forcedFailure).toBe(true); expect(record.attempts).toHaveLength(2);
    await table.pages[0]!.reload();
    const history = table.pages[0]!.getByRole('region', { name: '直近のサイコロ履歴', exact: true });
    const disclosure = history.locator('summary').first(); await disclosure.focus(); await disclosure.press('Enter');
    await expect(history.getByText(/強制失敗/)).toBeVisible();
    expect(views.get(owner)!.game!.recentRolls.find(roll => roll.rollId === rollId)).toEqual(record);
  } finally { await table.close(); }
});

test('turn-start recovery waits for a roll and resumes after a browser reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'roll-recovery');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const page = table.pages[0]!;
    const initial = views.get(owner)!.game!;
    expect(initial.phase).toBe('turn-start'); expect(initial.currentRoll?.purpose).toBe('status-recovery');
    await expect(page.getByRole('region', { name: '葵の状態異常', exact: true })).toContainText('沈黙');
    await expect(page.getByRole('region', { name: '葵の状態異常', exact: true })).toContainText('魔法技の使用と魔法技の新規詠唱はできません');
    await expect(page.getByRole('region', { name: 'サイコロの結果', exact: true })).toContainText('状態回復の判定');
    await page.reload();
    await expect(page.getByRole('region', { name: 'サイコロの結果', exact: true })).toContainText('判定前');
    const ended = await passUntil(table, views, game => !game.activeWindow && game.phase === 'draw');
    expect(ended.turnSeat).toBe(0);
    expect(ended.recentRolls.at(-1)).toMatchObject({ purpose: 'status-recovery', stage: 'applied' });
    await expect(page.getByRole('button', { name: 'カードを引く', exact: true })).toBeEnabled();
  } finally { await table.close(); }
});


test('numeric damage rolls offer reroll without a check-failure choice', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'roll-damage');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const page = table.pages[0]!;
    const original = views.get(owner)!.game!.currentRoll!;
    expect(original).toMatchObject({ kind: 'numeric', purpose: 'attack-damage', formula: 'd6x4', total: 4 });
    await expect(page.getByRole('region', { name: 'サイコロの結果', exact: true })).toContainText('1 × 4 = 4');
    const decision = page.getByRole('complementary', { name: '現在の判断' });
    const mode = decision.getByRole('combobox', { name: '割り込み効果', exact: true });
    await expect(mode.locator('option[value="force-fail"]')).toHaveCount(0);
    await decision.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r1c3');
    await decision.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.self.hand.includes('a2-p02-r1c3')).toBe(false);
    const rerolled = await passUntil(table, views, game => game.currentRoll?.rollId === original.rollId && game.currentRoll.generation === 1 && game.activeWindow?.kind === 'after-roll');
    expect(rerolled.currentRoll!.total).toBe(rerolled.currentRoll!.faces[0]! * 4);
    await expect(page.getByRole('region', { name: 'サイコロの結果', exact: true })).toContainText(`${rerolled.currentRoll!.faces[0]} × 4 = ${rerolled.currentRoll!.total}`);
  } finally { await table.close(); }
});
