import { expect, test } from '@playwright/test';
import { getAction } from '../../packages/catalog/src/index.js';
import { observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

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
function originalSource(table: Table, views: Views) {
  const attack = game(table, views).currentAttack!;
  const original = table.expected!.actions![attack.actionId]!;
  expect(original.actorId).toBe(table.sessions[0]!.id);
  expect(original.kind).toBe('attack');
  const shared = original.cardInstanceId === 'a2-p18-r1c3';
  expect(original.cardInstanceId).toBe(shared ? 'a2-p18-r1c3' : 'a2-p14-r1c2');
  expect(attack.technique).toMatchObject({ effectLevel: shared ? 6 : 5, damage: shared ? 8 : 6 });
  return original.cardInstanceId;
}
async function consumed(done: ReturnType<typeof game>, source: string | null) {
  if(source===null)throw Error('EXPECTED_PHYSICAL_SOURCE');
  expect((await storedDiscard()).filter(id => id === source)).toHaveLength(1);
  expect(done.self.hand).not.toContain(source);
  expect(done.self.chants.map(card => card.cardInstanceId)).not.toContain(source);
  expect(done.self.followers.map(card => card.cardInstanceId)).not.toContain(source);
}
function hiddenSource(table: Table, views: Views, abilityId: string, name: string) {
  expect(game(table, views).players[table.sessions[1]!.id]!.revealed).toBe(false);
  for (const seat of [0, 2, 3]) {
    const json = JSON.stringify(game(table, views, seat));
    expect(json).not.toContain(abilityId);
    expect(json).not.toContain(name);
  }
}
function privateGoals(table: Table, views: Views) {
  for (const seat of [1, 2, 3]) {
    const publicA = game(table, views, seat).players[table.sessions[0]!.id]!;
    for (const key of ['currentObjective', 'protection', 'defeatCondition', 'objective']) expect(publicA).not.toHaveProperty(key);
  }
}
const choices = [
  { scenario: 'mental-lester-choice', name: '魔詩', id: 'c2-p03-r2c1-ab01' },
  { scenario: 'mental-dia-choice', name: '魅了', id: 'c2-p06-r1c2-ab01' },
  { scenario: 'mental-fear-choice', name: '恐怖', id: 'c2-p06-r1c1-ab01' },
] as const;
for (const entry of choices) test(`${entry.scenario} may decline the optional mental defense`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    await expect(table.pages[1]!.getByRole('button', { name: `${entry.name}を使う`, exact: true })).toBeEnabled();
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(6);
    expect(done.recentRolls.filter(roll => roll.purpose === 'ability-check')).toEqual([]);
    expect(done.players[table.sessions[0]!.id]!.statuses).toEqual([]);
    await consumed(done, source);
  } finally { await table.close(); }
});
test('actual Lester selection saves a real random roll across reload and uses its final faces', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'mental-lester-choice');
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    await click(table, views, 1, '魔詩を使う');
    hiddenSource(table, views, choices[0].id, '魔詩');
    await reload(table, views, 1);
    await passUntil(table, views, state => state.currentRoll?.purpose === 'ability-check' && state.currentRoll.stage === 'after-roll', 500);
    const roll = structuredClone(game(table, views).currentRoll!);
    expect(roll).toMatchObject({ rollerId: table.sessions[0]!.id, modifier: -1, success: true });
    for (const seat of [1, 2, 3]) expect(game(table, views, seat).currentRoll!.threshold).toBeUndefined();
    await reload(table, views);
    expect(game(table, views).currentRoll).toEqual(roll);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    const double = roll.faces![0] === roll.faces![1];
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(double ? 0 : 6);
    expect(done.players[table.sessions[0]!.id]!.statuses.some(status => status.timing === 'next-own-seat')).toBe(double);
    await consumed(done, source);
  } finally { await table.close(); }
});
test('actual Fate cancels hidden mental source and a reload does not restore the spent attempt', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'mental-fear-choice');
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    await click(table, views, 1, '恐怖を使う');
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[2]!.id, 500);
    hiddenSource(table, views, choices[2].id, '恐怖');
    await table.pages[2]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await click(table, views, 2, '割り込みを使う');
    hiddenSource(table, views, choices[2].id, '恐怖');
    await reload(table, views, 2);
    await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500);
    await reload(table, views, 1);
    await expect(table.pages[1]!.getByRole('button', { name: '恐怖を使う', exact: true })).toHaveCount(0);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(6);
    expect(done.recentRolls.filter(roll => roll.purpose === 'ability-check')).toEqual([]);
    expect((await storedDiscard()).filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
    await consumed(done, source);
  } finally { await table.close(); }
});
for (const entry of [
  { scenario: 'mental-lester-six', faction: 'GOOD', objective: 'EVILの全滅', enemies: ['EVIL'], defeat: 'リーア姫の死亡', protection: ['c2-p03-r1c2'] },
  { scenario: 'mental-dia-six', faction: 'EVIL', objective: 'ディアと敵対するものの全滅', enemies: ['GOOD', 'ヴァンミール'], defeat: '愛しいディアの死亡', protection: ['c2-p06-r1c2'] },
] as const) test(`${entry.scenario} restores saved sixes then shows exact current private victory and defeat conditions`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    expect(game(table, views).currentRoll!.faces).toEqual([6, 6]);
    await reload(table, views);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.self).toMatchObject({ faction: entry.faction, objective: entry.objective, currentObjective: { enemyFactions: entry.enemies }, protection: { characterIds: entry.protection }, defeatCondition: entry.defeat });
    const goals = table.pages[0]!.getByRole('region', { name: '現在の勝利・敗北条件' });
    await expect(goals).toContainText(entry.objective);
    await expect(goals).toContainText(entry.defeat);
    await expect(goals).toContainText(entry.enemies.join('・'));
    privateGoals(table, views);
    await reload(table, views);
    await expect(goals).toContainText(entry.defeat);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(0);
    expect(done.players[table.sessions[0]!.id]!.statuses).toContainEqual({ kind: 'stopped', timing: 'next-own-seat', expiresOnActorId: table.sessions[0]!.id });
    await consumed(done, source);
  } finally { await table.close(); }
});
test('fixed allegiance preserves current goals after Dia sixes while cancellation and stop still apply', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'mental-dia-fixed-six');
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    const before = structuredClone(game(table, views).self);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    for (const key of ['faction', 'objective', 'currentObjective', 'protection', 'defeatCondition'] as const) expect(done.self[key]).toEqual(before[key]);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(0);
    expect(done.players[table.sessions[0]!.id]!.statuses).toContainEqual({ kind: 'stopped', timing: 'next-own-seat', expiresOnActorId: table.sessions[0]!.id });
    await reload(table, views);
    await expect(table.pages[0]!.getByRole('region', { name: '現在の勝利・敗北条件' })).toContainText(before.objective);
    await consumed(done, source);
  } finally { await table.close(); }
});
test('ordinary doubles stop until the actual attacker seat arrives without any recovery roll', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'mental-lester-double');
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    const before = structuredClone(game(table, views).self);
    expect(game(table, views).currentRoll!.faces).toEqual([2, 2]);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.self.faction).toBe(before.faction);
    expect(done.self.protection).toEqual(before.protection);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(0);
    await consumed(done, source);
    const attacker = table.sessions[0]!.id;
    const panel = table.pages[0]!.getByRole('article').filter({ has: table.pages[0]!.getByRole('heading', { name: '葵', exact: true }) });
    await expect(panel).toContainText('回復判定はありません');
    await reload(table, views);
    await click(table, views, 0, '離脱しない');
    for (const seat of [1, 2, 3]) {
      expect(game(table, views).players[attacker]!.statuses.some(status => status.timing === 'next-own-seat')).toBe(true);
      await click(table, views, seat, '手番を始める');
      await click(table, views, seat, 'カードを引かない');
      await click(table, views, seat, '行動を終える');
      await click(table, views, seat, '選んだ0枚を捨てて手番を終える');
    }
    expect(game(table, views).turnSeat).toBe(0);
    expect(game(table, views).players[attacker]!.statuses).toEqual([]);
    await click(table, views, 0, '手番を始める');
    expect(game(table, views).currentRoll).toBeNull();
    expect(game(table, views).phase).toBe('draw');
  } finally { await table.close(); }
});
test('saved real Fate non-double failure cancels the attack without stopping or converting the attacker', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'mental-lester-failed');
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    const before = structuredClone(game(table, views).self);
    expect(game(table, views).currentRoll).toMatchObject({ faces: [1, 2], forcedFailure: true, success: false });
    await reload(table, views);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(0);
    expect(done.players[table.sessions[0]!.id]!.statuses).toEqual([]);
    expect(done.self.faction).toBe(before.faction);
    expect(done.self.protection).toEqual(before.protection);
    expect((await storedDiscard()).filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
    await consumed(done, source);
  } finally { await table.close(); }
});
for (const giftUsed of [false, true]) test(`Fear pending fatal notice preserves the other target before death gift use=${giftUsed}`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, giftUsed ? 'mental-fear-six-gift' : 'mental-fear-six-shared');
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    const [a, b, c, d] = table.sessions.map(session => session.id) as [string, string, string, string];
    expect(game(table, views).currentRoll!.faces).toEqual([6, 6]);
    await passUntil(table, views, state => state.players[a]!.pendingFatal, 500);
    expect(game(table, views).players[a]).toMatchObject({ presence: 'active', pendingFatal: true, damage: 0 });
    expect(game(table, views).players[c]!.damage).toBe(0);
    expect((await storedDiscard())).not.toContain(source);
    hiddenSource(table, views, choices[2].id, '恐怖');
    for (const page of table.pages) await expect(page.getByRole('region', { name: '保留中の死亡効果' })).toContainText('宣言済みの攻撃を解決した後');
    await reload(table, views);
    await passUntil(table, views, state => state.lifecycleDecision?.kind === 'death-gift' && state.activeWindow?.pendingActorId === a, 500);
    expect(game(table, views).players[c]!.damage).toBe(8);
    expect(game(table, views).players[a]).toMatchObject({ presence: 'pending-death', pendingFatal: false });
    for (const page of table.pages) await expect(page.getByRole('region', { name: '保留中の死亡効果' })).toHaveCount(0);
    await reload(table, views);
    const hand = game(table, views).self.hand;
    const giftCost = hand.find(id => getAction(id)?.name === '「姫を頼む」');
    const gift = hand.find(id => getAction(id)?.name === '必勝の祈り');
    if (giftUsed) {
      expect(giftCost).toBeTruthy();
      expect(gift).toBeTruthy();
      await table.pages[0]!.getByLabel('死亡時に使うカード').selectOption(giftCost!);
      await table.pages[0]!.getByLabel('相手に託す手札').selectOption(gift!);
      await table.pages[0]!.getByLabel('カードを託す相手').selectOption(d);
      await click(table, views, 0, '選んだ手札を託す');
      await reload(table, views);
    }
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[a]!.presence).toBe('dead');
    expect(done.players[b]!.damage).toBe(0);
    expect(done.players[c]!.damage).toBe(8);
    if (giftUsed) {
      expect(game(table, views, 3).self.hand.filter(id => id === gift)).toHaveLength(1);
      expect((await storedDiscard()).filter(id => id === giftCost)).toHaveLength(1);
      expect((await storedDiscard())).not.toContain(gift);
      for (const seat of [1, 2]) expect(JSON.stringify(game(table, views, seat))).not.toContain(gift);
    }
    await consumed(done, source);
    await reload(table, views);
  } finally { await table.close(); }
});
test('a real divine reroll keeps forced failure but derives stopping from the final faces', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'mental-lester-failed');
  try {
    const views = await observe(table);
    const source = originalSource(table, views);
    const before = structuredClone(game(table, views).self);
    const rollId = game(table, views).currentRoll!.rollId;
    await passUntil(table, views, state => state.activeWindow?.kind === 'after-roll' && state.currentRoll?.rollId === rollId && state.activeWindow.pendingActorId === table.sessions[3]!.id, 500);
    const decision = table.pages[3]!.getByRole('complementary', { name: '現在の判断' });
    await decision.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption('reroll');
    await decision.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r1c3');
    await click(table, views, 3, '割り込みを使う');
    await reload(table, views, 3);
    await passUntil(table, views, state => state.currentRoll?.rollId === rollId && state.currentRoll.generation === 1 && state.currentRoll.stage === 'after-roll', 500);
    const finalRoll = structuredClone(game(table, views).currentRoll!);
    expect(finalRoll).toMatchObject({ forcedFailure: true, success: false, generation: 1 });
    expect(finalRoll.attempts).toHaveLength(2);
    await reload(table, views);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    const double = finalRoll.faces[0] === finalRoll.faces[1];
    const sixes = double && finalRoll.faces[0] === 6;
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(0);
    expect(done.players[table.sessions[0]!.id]!.statuses.some(status => status.timing === 'next-own-seat')).toBe(double);
    expect(done.self.faction).toBe(sixes ? 'GOOD' : before.faction);
    expect(done.self.protection.characterIds).toEqual(sixes ? ['c2-p03-r1c2'] : before.protection.characterIds);
    for (const id of ['a2-p02-r1c3', 'a2-p02-r2c3']) expect((await storedDiscard()).filter(card => card === id)).toHaveLength(1);
    await consumed(done, source);
  } finally { await table.close(); }
});
