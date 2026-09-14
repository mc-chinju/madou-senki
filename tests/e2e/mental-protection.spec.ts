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
async function reload(table: Table, views: Views, seat = 0) {
  const before = structuredClone(game(table, views, seat));
  await table.pages[seat]!.reload();
  await expect(table.pages[seat]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
  expect(game(table, views, seat)).toEqual(before);
}
function originalSource(table: Table, views: Views, expected = 'a2-p14-r1c2') {
  const original = table.expected!.actions![game(table, views).currentAttack!.actionId]!;
  expect(original).toMatchObject({ actorId: table.sessions[0]!.id, kind: 'attack', cardInstanceId: expected });
  return original.cardInstanceId;
}
function consumed(done: ReturnType<typeof game>, source: string | null) {
  if(source===null)throw Error('EXPECTED_PHYSICAL_SOURCE');
  expect(done.discard.filter(id => id === source)).toHaveLength(1);
  expect(done.self.hand).not.toContain(source);
  expect(done.self.chants.map(card => card.cardInstanceId)).not.toContain(source);
  expect(done.self.followers.map(card => card.cardInstanceId)).not.toContain(source);
}
function privateAbility(table: Table, views: Views, owner: number, id: string) {
  for (let seat = 0; seat < table.sessions.length; seat++) {
    if (seat !== owner) expect(JSON.stringify(game(table, views, seat))).not.toContain(id);
  }
}
async function use(table: Table, views: Views, seat: number, name: string) {
  await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[seat]!.id, 500);
  await click(table, views, seat, `${name}を使う`);
}
async function reaction(table: Table, views: Views, seat: number, mode: 'cancel-ability' | 'force-fail' | 'reroll', cardId: string) {
  await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[seat]!.id, 500);
  const panel = table.pages[seat]!.getByRole('complementary', { name: '現在の判断' });
  await panel.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption(mode);
  await panel.getByRole('combobox', { name: '使うカード', exact: true }).selectOption(cardId);
  await click(table, views, seat, '割り込みを使う');
}
const named = [
  { scenario: 'protect-cham', seat: 2, name: 'いたずらしちゃった', id: 'c2-p01-r2c2-ab04' },
  { scenario: 'protect-tia', seat: 0, name: '私、同性には興味がないもので', id: 'c2-p02-r1c1-ab03' },
  { scenario: 'protect-lancelot', seat: 0, name: '不屈の意志', id: 'c2-p02-r2c2-ab03' },
  { scenario: 'protect-lancelot-ii', seat: 0, name: '不屈の意志', id: 'c2-p02-r2c2-ab03' },
  { scenario: 'protect-uonos', seat: 0, name: '愛など無駄だ', id: 'c2-p05-r1c1-ab03' },
  { scenario: 'protect-gad-response', seat: 0, name: '死者', id: 'c2-p06-r1c1-ab02' },
] as const;
for (const entry of named) test(`${entry.scenario} selects the exact named response and restores its pending frame`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario, entry.scenario === 'protect-lancelot-ii' ? 5 : 4);
  try {
    const views = await observe(table);
    const source = originalSource(table, views, entry.scenario === 'protect-gad-response' ? 'a2-p16-r2c3' : undefined);
    const frame = game(table, views).reactionTargetAbilityId;
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[entry.seat]!.id, 500);
    expect(game(table, views, entry.seat).abilityOptions.find(option => option.abilityId === entry.id)).toMatchObject({ targetEventId: frame, description: '宣言中の特殊能力を取り消す。' });
    await expect(table.pages[entry.seat]!.getByRole('region', { name: '使える特殊能力' })).toContainText('宣言中の特殊能力を取り消す。');
    await click(table, views, entry.seat, `${entry.name}を使う`);
    if (entry.scenario !== 'protect-cham' && entry.scenario !== 'protect-lancelot-ii') privateAbility(table, views, entry.seat, entry.id);
    await reload(table, views, entry.seat);
    expect(game(table, views).reactionTargetAbilityId).not.toBe(frame);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.recentRolls.filter(roll => roll.purpose === 'ability-check')).toEqual([]);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(6);
    consumed(done, source);
  } finally { await table.close(); }
});
for (const cancel of [false, true]) test(`Cham response selected=${cancel} then declined or canceled leaves the real mental check`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'protect-cham');
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[2]!.id, 500);
    await expect(table.pages[2]!.getByRole('button', { name: 'いたずらしちゃったを使う', exact: true })).toBeEnabled();
    if (cancel) {
      await click(table, views, 2, 'いたずらしちゃったを使う');
      await reaction(table, views, 3, 'cancel-ability', 'a2-p02-r2c3');
      await reload(table, views, 3);
    }
    await passUntil(table, views, state => state.currentRoll?.purpose === 'ability-check' && state.currentRoll.stage === 'after-roll', 500);
    const roll = structuredClone(game(table, views).currentRoll!);
    expect(roll.success).toBe(true);
    await reload(table, views);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    const double = roll.faces[0] === roll.faces[1];
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(double ? 0 : 6);
    expect(done.players[table.sessions[0]!.id]!.statuses.some(status => status.timing === 'next-own-seat')).toBe(double);
    if (cancel) expect(done.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
    consumed(done, source);
  } finally { await table.close(); }
});
for (const entry of [
  { scenario: 'protect-cham-hidden-owner', seat: 2, name: 'いたずらしちゃった' },
  { scenario: 'protect-tia-hidden-source', seat: 0, name: '私、同性には興味がないもので' },
] as const) test(`${entry.scenario} preserves public eligibility without revealing the hidden source`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[entry.seat]!.id, 500);
    await expect(table.pages[entry.seat]!.getByRole('button', { name: `${entry.name}を使う`, exact: true })).toHaveCount(0);
    if (entry.scenario === 'protect-tia-hidden-source') privateAbility(table, views, 1, 'c2-p06-r1c2-ab01');
    await reload(table, views, entry.seat);
    await passUntil(table, views, state => state.currentRoll?.purpose === 'ability-check' && state.currentRoll.stage === 'after-roll', 500);
    const double = game(table, views).currentRoll!.faces[0] === game(table, views).currentRoll!.faces[1];
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(double ? 0 : 6);
    consumed(done, source);
  } finally { await table.close(); }
});
const guards = [
  { scenario: 'protect-gil-six', name: '信仰心', id: 'c2-p01-r1c2-ab04', damage: 0, success: false },
  { scenario: 'protect-shin-six', name: '精神統一', id: 'c2-p01-r2c1-ab04', damage: 6, success: true },
  { scenario: 'protect-garwin-six', name: '執念', id: 'c2-p05-r2c1-ab02', damage: 6, success: true },
] as const;
for (const entry of guards) test(`${entry.scenario} selected guard removes doubles consequences while ordinary failure remains`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    const before = structuredClone(game(table, views).self);
    expect(game(table, views).currentRoll).toMatchObject({ faces: [6, 6], success: entry.success });
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[0]!.id, 500);
    await expect(table.pages[0]!.getByRole('region', { name: '使える特殊能力' })).toContainText('通常失敗は有効');
    await click(table, views, 0, `${entry.name}を使う`);
    privateAbility(table, views, 0, entry.id);
    await reload(table, views);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(entry.damage);
    expect(done.players[table.sessions[0]!.id]).toMatchObject({ presence: 'active', pendingFatal: false, statuses: [] });
    expect(done.self.faction).toBe(before.faction);
    expect(done.self.protection).toEqual(before.protection);
    consumed(done, source);
  } finally { await table.close(); }
});
test('canceling a selected Garwin guard restores Dia sixes and does not restore the spent attempt', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'protect-garwin-six');
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    await use(table, views, 0, '執念');
    await reaction(table, views, 3, 'cancel-ability', 'a2-p02-r2c3');
    await reload(table, views, 3);
    await passUntil(table, views, state => state.currentRoll?.stage === 'after-roll' && state.activeWindow?.pendingActorId === table.sessions[0]!.id, 500);
    await expect(table.pages[0]!.getByRole('button', { name: '執念を使う', exact: true })).toHaveCount(0);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(0);
    expect(done.players[table.sessions[0]!.id]!.statuses.some(status => status.timing === 'next-own-seat')).toBe(true);
    expect(done.self.protection.characterIds).toEqual(['c2-p06-r1c2']);
    expect(done.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
    consumed(done, source);
  } finally { await table.close(); }
});
test('saved guard survives a real divine reroll while Fate forced failure still cancels the attack', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'protect-garwin-six');
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    const before = structuredClone(game(table, views).self);
    const rollId = game(table, views).currentRoll!.rollId;
    await use(table, views, 0, '執念');
    await passUntil(table, views, state => state.currentRoll?.stage === 'after-roll' && state.activeWindow?.kind === 'after-roll', 500);
    await reaction(table, views, 3, 'force-fail', 'a2-p02-r2c3');
    await passUntil(table, views, state => state.currentRoll?.rollId === rollId && state.currentRoll.forcedFailure === true && state.currentRoll.stage === 'after-roll' && state.activeWindow?.kind === 'after-roll', 500);
    await reaction(table, views, 2, 'reroll', 'a2-p02-r1c3');
    await reload(table, views, 2);
    await passUntil(table, views, state => state.currentRoll?.rollId === rollId && state.currentRoll.generation === 1 && state.currentRoll.stage === 'after-roll', 500);
    expect(game(table, views).currentRoll).toMatchObject({ success: false, forcedFailure: true, generation: 1 });
    await reload(table, views);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(0);
    expect(done.players[table.sessions[0]!.id]!.statuses).toEqual([]);
    expect(done.self.faction).toBe(before.faction);
    expect(done.self.protection).toEqual(before.protection);
    for (const id of ['a2-p02-r1c3', 'a2-p02-r2c3']) expect(done.discard.filter(card => card === id)).toHaveLength(1);
    consumed(done, source);
  } finally { await table.close(); }
});
test('Garwin Nightmare clause keeps damage and a real forced failed resistance while preventing only stopping', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'protect-garwin-nightmare');
  try {
    const views = await observe(table);
    const source = originalSource(table, views, 'a2-p15-r2c2');
    await expect(table.pages[1]!.getByRole('region', { name: '使える特殊能力' })).toContainText('停止だけを防ぐ');
    await use(table, views, 1, '執念');
    await reload(table, views, 1);
    await passUntil(table, views, state => state.currentRoll?.purpose === 'status-resistance' && state.currentRoll.stage === 'after-roll', 500);
    await reaction(table, views, 3, 'force-fail', 'a2-p02-r2c3');
    await passUntil(table, views, state => state.currentRoll?.purpose === 'status-resistance' && state.currentRoll.forcedFailure === true, 500);
    expect(game(table, views, 1).currentRoll!.success).toBe(false);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]).toMatchObject({ damage: 2, statuses: [] });
    consumed(done, source);
  } finally { await table.close(); }
});
for (const entry of [
  { scenario: 'protect-gad-warrior', source: 'a2-p08-r3c3' },
  { scenario: 'protect-gad-null', source: 'a2-p17-r2c3' },
] as const) test(`${entry.scenario} cancels all received 精 effects before resistance`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const source = originalSource(table, views, entry.source);
    if (entry.scenario === 'protect-gad-null') expect(game(table, views).currentAttack!.technique.damage).toBeNull();
    await expect(table.pages[1]!.getByRole('region', { name: '使える特殊能力' })).toContainText('精神技の効果をすべて無効');
    await use(table, views, 1, '死者');
    privateAbility(table, views, 1, 'c2-p06-r1c1-ab02');
    await reload(table, views, 1);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(0);
    expect(done.recentRolls.filter(roll => roll.purpose === 'status-resistance')).toEqual([]);
    consumed(done, source);
  } finally { await table.close(); }
});
test('Gil dedicated 気破 keeps its printed Gad exception in the actual defense UI', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'protect-gad-gil-exception');
  try {
    const views = await observe(table);
    const source = originalSource(table, views, 'a2-p09-r3c2');
    expect(game(table, views).currentAttack!.technique.damage).toBe(38);
    await expect(table.pages[1]!.getByRole('button', { name: '死者を使う', exact: true })).toHaveCount(0);
    await reload(table, views, 1);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(38);
    consumed(done, source);
  } finally { await table.close(); }
});
