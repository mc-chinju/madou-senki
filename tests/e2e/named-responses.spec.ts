import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
function game(table: Table, views: Views, seat = 0) { return views.get(table.sessions[seat]!.id)!.game!; }
async function click(table: Table, views: Views, seat: number, label: string) {
  const owner = table.sessions[0]!.id;
  const revision = views.get(owner)!.revision;
  await table.pages[seat]!.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
}
function originalSource(table: Table, views: Views) {
  // Source declaration overlays currentAction; the actual fixture's original attack retains the card.
  const attack = game(table, views).currentAttack!;
  const original = table.expected!.actions![attack.actionId]!;
  expect(original.actorId).toBe(table.sessions[0]!.id);
  expect(original.kind).toBe('attack');
  expect(original.cardInstanceId).toBe('a2-p14-r1c2');
  expect(attack.technique).toMatchObject({ effectLevel: 5, damage: 6 });
  return original.cardInstanceId;
}
function consumed(done: ReturnType<typeof game>, source: string) {
  expect(done.discard.filter(id => id === source)).toHaveLength(1);
  expect(done.self.hand).not.toContain(source);
  expect(done.self.chants.map(card => card.cardInstanceId)).not.toContain(source);
  expect(done.self.followers.map(card => card.cardInstanceId)).not.toContain(source);
}
function hiddenSource(table: Table, views: Views, abilityId: string, name: string) {
  for (const seat of [0, 2, 3]) {
    const json = JSON.stringify(game(table, views, seat));
    expect(json).not.toContain(abilityId);
    expect(json).not.toContain(name);
  }
}
const positive = [
  { scenario: 'response-mirror-attacker', seat: 0, ability: '鏡心', id: 'c2-p01-r2c1-ab05' },
  { scenario: 'response-mirror-third', seat: 2, ability: '鏡心', id: 'c2-p01-r2c1-ab05' },
  { scenario: 'response-sorrow', seat: 0, ability: '悲しみを胸に', id: 'c2-p07-r1c1-ab02' },
] as const;
for (const entry of positive) test(`${entry.scenario} cancels exactly the pending source and survives reload`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    const originalAbility = game(table, views).reactionTargetAbilityId!;
    const actor = table.sessions[entry.seat]!.id;
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === actor, 500);
    expect(game(table, views, entry.seat).abilityOptions.find(option => option.abilityId === entry.id)?.targetEventId).toBe(originalAbility);
    await click(table, views, entry.seat, `${entry.ability}を使う`);
    const response = game(table, views).reactionTargetAbilityId;
    expect(response).not.toBe(originalAbility);
    await table.pages[entry.seat]!.reload();
    await expect(table.pages[entry.seat]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
    expect(game(table, views, entry.seat).reactionTargetAbilityId).toBe(response);
    await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500);
    expect(game(table, views).recentRolls.filter(roll => roll.purpose === 'ability-check')).toEqual([]);
    expect(game(table, views).currentAttack!.reflection).toBeUndefined();
    await expect(table.pages[1]!.getByRole('button', { name: entry.ability === '鏡心' ? '影分身を使う' : '魔導王の威厳を使う', exact: true })).toHaveCount(0);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(6);
    expect(done.players[table.sessions[0]!.id]!.damage).toBe(0);
    consumed(done, source);
  } finally { await table.close(); }
});
for (const entry of [positive[0], positive[2]]) test(`${entry.scenario} may decline cancellation`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[entry.seat]!.id, 500);
    await expect(table.pages[entry.seat]!.getByRole('button', { name: `${entry.ability}を使う`, exact: true })).toBeEnabled();
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(entry.ability === '鏡心' ? 6 : 0);
    expect(done.players[table.sessions[0]!.id]!.damage).toBe(entry.ability === '鏡心' ? 0 : 6);
    expect(done.recentRolls.filter(roll => roll.purpose === 'ability-check')).toHaveLength(entry.ability === '鏡心' ? 2 : 1);
    consumed(done, source);
  } finally { await table.close(); }
});
for (const entry of [positive[1], positive[2]]) test(`${entry.scenario} a canceled response resumes its original source after reload`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    const originalAbility = game(table, views).reactionTargetAbilityId!;
    const actor = table.sessions[entry.seat]!.id;
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === actor, 500);
    await click(table, views, entry.seat, `${entry.ability}を使う`);
    const response = game(table, views).reactionTargetAbilityId;
    expect(response).not.toBe(originalAbility);
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[3]!.id, 500);
    await table.pages[3]!.reload();
    await table.pages[3]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await click(table, views, 3, '割り込みを使う');
    await passUntil(table, views, state => state.reactionTargetAbilityId === originalAbility && state.activeWindow?.pendingActorId === actor, 500);
    await table.pages[entry.seat]!.reload();
    await expect(table.pages[entry.seat]!.getByRole('button', { name: `${entry.ability}を使う`, exact: true })).toHaveCount(0);
    expect(game(table, views).reactionTargetAbilityId).toBe(originalAbility);
    if (entry.ability === '悲しみを胸に') {
      await passUntil(table, views, state => !!state.currentAttack?.reflection, 500);
      await table.pages[0]!.reload();
      await expect(table.pages[0]!.getByRole('region', { name: '各対象が受ける技' })).toContainText('楓さんが白光を跳ね返しています');
      expect(game(table, views).currentAttack!.reflection?.sourceCardInstanceId).toBe(source);
      await table.pages[0]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p05-r3c1');
      await click(table, views, 0, '防御する');
    } else {
      await passUntil(table, views, state => state.currentRoll?.purpose === 'ability-check' && state.currentRoll.stage === 'after-roll', 500);
      const roll = structuredClone(game(table, views).currentRoll);
      await table.pages[0]!.reload();
      await expect(table.pages[0]!.getByRole('region', { name: 'サイコロの結果' })).toContainText('特殊能力の判定');
      expect(game(table, views).currentRoll).toEqual(roll);
    }
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(entry.ability === '鏡心' ? 6 : 0);
    expect(done.players[table.sessions[0]!.id]!.damage).toBe(0);
    expect(done.recentRolls.filter(roll => roll.purpose === 'ability-check')).toHaveLength(entry.ability === '鏡心' ? 2 : 1);
    expect(done.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
    if (entry.ability === '悲しみを胸に') expect(done.discard.filter(id => id === 'a2-p05-r3c1')).toHaveLength(1);
    consumed(done, source);
  } finally { await table.close(); }
});
for (const entry of [
  { scenario: 'response-mirror-hidden-source', seat: 0, ability: '鏡心' },
  { scenario: 'response-mirror-hidden-owner', seat: 0, ability: '鏡心' },
  { scenario: 'response-sorrow-hidden-source', seat: 0, ability: '悲しみを胸に' },
  { scenario: 'response-sorrow-unrelated', seat: 2, ability: '悲しみを胸に' },
] as const) test(`${entry.scenario} offers no response for an ineligible public relationship`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[entry.seat]!.id, 500);
    await expect(table.pages[entry.seat]!.getByRole('button', { name: `${entry.ability}を使う`, exact: true })).toHaveCount(0);
    if (entry.scenario.endsWith('hidden-source')) {
      hiddenSource(table, views, entry.ability === '鏡心' ? 'c2-p04-r2c2-ab01' : 'c2-p05-r2c2-ab02', entry.ability === '鏡心' ? '影分身' : '魔導王の威厳');
      await table.pages[entry.seat]!.reload();
      await expect(table.pages[entry.seat]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
      hiddenSource(table, views, entry.ability === '鏡心' ? 'c2-p04-r2c2-ab01' : 'c2-p05-r2c2-ab02', entry.ability === '鏡心' ? '影分身' : '魔導王の威厳');
    }
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(entry.ability === '鏡心' ? 6 : 0);
    expect(done.players[table.sessions[0]!.id]!.damage).toBe(entry.ability === '鏡心' ? 0 : 6);
    consumed(done, source);
  } finally { await table.close(); }
});
