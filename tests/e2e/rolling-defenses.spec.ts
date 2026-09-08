import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
function game(table: Table, views: Views, seat = 0) { return views.get(table.sessions[seat]!.id)!.game!; }
async function click(table: Table, views: Views, seat: number, label: string) {
  const owner = table.sessions[0]!.id; const revision = views.get(owner)!.revision;
  await table.pages[seat]!.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
}
function incoming(table: Table, seat = 1) { return table.pages[seat]!.getByRole('region', { name: '各対象が受ける技' }); }
function source(table: Table, views: Views) {
  const action = game(table, views).currentAction;
  expect(action).toMatchObject({ source: 'card', sourceZone: 'hand', actorId: table.sessions[0]!.id });
  if (!action || action.source !== 'card') throw Error('ROLLING_SOURCE_MISSING'); return action.cardInstanceId;
}
function consumed(done: ReturnType<typeof game>, cardId: string) {
  expect(done.discard.filter(id => id === cardId)).toHaveLength(1); expect(done.self.hand).not.toContain(cardId);
  expect(done.self.chants.map(card => card.cardInstanceId)).not.toContain(cardId);
  expect(done.self.followers.map(card => card.cardInstanceId)).not.toContain(cardId);
}
function concealed(table: Table, views: Views, id: string, name: string) {
  for (const seat of [0, 2, 3]) { const json = JSON.stringify(game(table, views, seat)); expect(json).not.toContain(id); expect(json).not.toContain(name); }
}
async function failCheck(table: Table, views: Views) {
  const c = table.sessions[2]!.id;
  await passUntil(table, views, state => state.currentRoll?.purpose === 'ability-check' && state.currentRoll?.stage === 'after-roll' && state.activeWindow?.pendingActorId === c, 500);
  await table.pages[2]!.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption('force-fail');
  await table.pages[2]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
  await click(table, views, 2, '割り込みを使う');
}
for (const selected of [false, true]) test(`magic half selected=${selected} resolves after Soldier HP`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'defense-half');
  try {
    const views = await observe(table); const original = source(table, views); const b = table.sessions[1]!.id;
    await expect(table.pages[1]!.getByRole('button', { name: '魔法抵抗を使う', exact: true })).toBeEnabled();
    if (selected) {
      await click(table, views, 1, '魔法抵抗を使う');
      await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500); await table.pages[1]!.reload();
      await expect(table.pages[1]!.getByRole('button', { name: '魔法抵抗を使う', exact: true })).toHaveCount(0);
    }
    await passUntil(table, views, state => state.followerDefenseResults.some(result => result.cardInstanceId === 'a2-p18-r3c3'), 500);
    expect(game(table, views).followerDefenseResults[0]!.hits[0]!.hpReduction).toBe(1);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(selected ? 2 : 5); consumed(done, original);
  } finally { await table.close(); }
});
test('half final body value survives reload while the other target retains its incoming value', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'defense-half-shared');
  try {
    const views = await observe(table); const original = source(table, views); const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    await click(table, views, 1, '魔法抵抗を使う');
    await passUntil(table, views, state => !!state.currentAttack?.targets[0]!.hits[0]!.bodyDamage, 500); await table.pages[1]!.reload();
    await expect(incoming(table).getByRole('listitem').filter({ hasText: '楓さん・1発目' })).toContainText('本人への確定ダメージ 3');
    await expect(incoming(table).getByRole('listitem').filter({ hasText: '凛さん・1発目' })).toContainText('効果Lv 6 / ダメージ 8');
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(3); expect(done.players[c]!.damage).toBe(8); consumed(done, original);
  } finally { await table.close(); }
});
for (const zero of [true, false]) test(`Grace zero=${zero} restores separate saved check and numeric die`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, zero ? 'defense-grace-zero' : 'defense-grace-residual');
  try {
    const views = await observe(table); const original = source(table, views); const b = table.sessions[1]!.id;
    await click(table, views, 1, '光の加護を使う'); let checkId = ''; let reduction = 0;
    for (const purpose of ['ability-check', 'ability-value']) {
      await passUntil(table, views, state => state.currentRoll?.purpose === purpose && state.currentRoll.stage === 'after-roll', 500);
      await expect.poll(() => game(table, views, 1).currentRoll?.stage).toBe('after-roll');
      await expect.poll(() => game(table, views, 1).currentRoll?.rollId).toBe(game(table, views).currentRoll!.rollId);
      const roll = structuredClone(game(table, views, 1).currentRoll!);
      if (purpose === 'ability-check') {
        expect(roll.threshold).toBeDefined();
        for (const seat of [0, 2, 3]) {
          expect(game(table, views, seat).currentRoll!.threshold).toBeUndefined();
          expect(game(table, views, seat).currentRoll!.success).toBeUndefined();
        }
      }
      expect(roll.faces).toHaveLength(purpose === 'ability-check' ? 2 : 1);
      if (purpose === 'ability-check') { checkId = roll.rollId; expect(roll.modifier).toBe(-3); }
      else { expect(roll.rollId).not.toBe(checkId); reduction = roll.faces[0]!; }
      await table.pages[1]!.reload();
      await expect(table.pages[1]!.getByRole('region', { name: 'サイコロの結果' })).toContainText(purpose === 'ability-check' ? '特殊能力の判定' : '特殊能力のサイコロ');
      expect(game(table, views, 1).currentRoll).toEqual(roll);
    }
    if (!zero) {
      await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500);
      await expect(incoming(table)).toContainText(`効果Lv ${8 - reduction} / ダメージ 10`);
      await expect(table.pages[1]!.getByRole('button', { name: '光の加護を使う', exact: true })).toHaveCount(0);
    }
    const done = await passUntil(table, views, state => !state.activeWindow, 500); expect(done.players[b]!.damage).toBe(zero ? 0 : 10); consumed(done, original);
  } finally { await table.close(); }
});
test('forced failed Grace check survives reload and never rolls a reduction die', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'defense-grace-zero');
  try {
    const views = await observe(table); const original = source(table, views); const b = table.sessions[1]!.id;
    await click(table, views, 1, '光の加護を使う'); await failCheck(table, views);
    await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500); await table.pages[1]!.reload();
    await expect(incoming(table)).toContainText('効果Lv 1 / ダメージ 2');
    await expect(table.pages[1]!.getByRole('button', { name: '光の加護を使う', exact: true })).toHaveCount(0);
    expect(game(table, views).recentRolls.filter(roll => roll.purpose === 'ability-value')).toEqual([]);
    const done = await passUntil(table, views, state => !state.activeWindow, 500); expect(done.players[b]!.damage).toBe(2);
    expect(done.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1); consumed(done, original);
  } finally { await table.close(); }
});
for (const failed of [false, true]) test(`transformed Light Shield failed=${failed} is independent from inherited armor`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'defense-shield');
  try {
    const views = await observe(table); const original = source(table, views); const b = table.sessions[1]!.id;
    await expect(table.pages[1]!.getByRole('button', { name: '白銀の鎧を使う', exact: true })).toBeEnabled();
    await click(table, views, 1, '光の盾を使う');
    if (failed) {
      await failCheck(table, views); await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500); await table.pages[1]!.reload();
      await expect(table.pages[1]!.getByRole('button', { name: '光の盾を使う', exact: true })).toHaveCount(0);
      await expect(table.pages[1]!.getByRole('button', { name: '白銀の鎧を使う', exact: true })).toBeEnabled();
    }
    const done = await passUntil(table, views, state => !state.activeWindow, 500); expect(done.players[b]!.damage).toBe(failed ? 6 : 0);
    if (failed) expect(done.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1); consumed(done, original);
  } finally { await table.close(); }
});
test('Majesty reflection restores public original technique and lets its attacker defend', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'defense-majesty');
  try {
    const views = await observe(table); const original = source(table, views); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id;
    await click(table, views, 1, '魔導王の威厳を使う');
    await passUntil(table, views, state => !!state.currentAttack?.reflection, 500); await table.pages[0]!.reload();
    await expect(incoming(table, 0)).toContainText('楓さんが白光を跳ね返しています');
    expect(game(table, views).currentAttack!.reflection).toEqual({ source: 'ability', actorId: b, sourceCardInstanceId: original });
    expect(game(table, views).currentAttack!.targetId).toBe(a); concealed(table, views, 'c2-p05-r2c2-ab02', '魔導王の威厳');
    await table.pages[0]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p05-r3c1');
    await click(table, views, 0, '防御する');
    const done = await passUntil(table, views, state => !state.activeWindow, 500); expect(done.players[a]!.damage).toBe(0); expect(done.players[b]!.damage).toBe(0);
    expect(done.discard.filter(id => id === 'a2-p05-r3c1')).toHaveLength(1); consumed(done, original);
  } finally { await table.close(); }
});
test('canceling Majesty through an actual private reaction spends the attempt without reflection', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'defense-majesty');
  try {
    const views = await observe(table); const original = source(table, views); const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    await click(table, views, 1, '魔導王の威厳を使う');
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === c && !!state.reactionTargetAbilityId, 500);
    concealed(table, views, 'c2-p05-r2c2-ab02', '魔導王の威厳'); await table.pages[2]!.reload();
    await table.pages[2]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await click(table, views, 2, '割り込みを使う'); concealed(table, views, 'c2-p05-r2c2-ab02', '魔導王の威厳');
    await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500); await table.pages[1]!.reload();
    await expect(table.pages[1]!.getByRole('button', { name: '魔導王の威厳を使う', exact: true })).toHaveCount(0);
    expect(game(table, views).currentAttack!.reflection).toBeUndefined();
    const done = await passUntil(table, views, state => !state.activeWindow, 500); expect(done.players[b]!.damage).toBe(6);
    expect(done.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1); consumed(done, original);
  } finally { await table.close(); }
});
