import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
async function useAbility(table: Table, views: Views, index: number, name: string) {
  const actor = table.sessions[index]!.id; const revision = views.get(actor)!.revision;
  await table.pages[index]!.getByRole('button', { name: `${name}を使う`, exact: true }).click();
  await expect.poll(() => views.get(actor)?.revision).toBeGreaterThan(revision);
}
for (const selected of [false, true]) test(`Lancaster dragon destruction selected=${selected} keeps the choice explicit after reload`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'destroy-lancaster');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id;
    const button = table.pages[0]!.getByRole('button', { name: '竜殺槍を使う', exact: true });
    await expect(button).toBeVisible();
    expect(views.get(a)!.game!.followerDefenseResults).toEqual([]);
    if (selected) await useAbility(table, views, 0, '竜殺槍');
    await table.pages[0]!.reload(); await expect(table.pages[0]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
    const reached = await passUntil(table, views, game => game.followerDefenseResults.length > 0, 500);
    expect(reached.followerDefenseResults).toMatchObject([{ targetId: b, source: 'physical', cardInstanceId: 'a2-p22-r3c1', hits: [{ outcome: selected ? 'attribute-destroyed' : 'blocked', hpReduction: 0 }] }]);
    const summary = table.pages[0]!.getByRole('region', { name: '従者への攻撃と結果' });
    await expect(summary).toContainText('飛竜'); await expect(summary).toContainText(selected ? '属性による破壊' : '防御成功');
    await expect(button).toHaveCount(0);
    const done = await passUntil(table, views, game => !game.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(selected ? 7 : 0);
    expect(done.players[b]!.followers).toHaveLength(selected ? 0 : 1);
  } finally { await table.close(); }
});
test('a third party cancels Lancaster after reload and the dragon still blocks the original attack', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'destroy-lancaster');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    await useAbility(table, views, 0, '竜殺槍');
    await passUntil(table, views, game => game.activeWindow?.pendingActorId === c && !!game.reactionTargetAbilityId, 500);
    await table.pages[2]!.reload(); await table.pages[2]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    const revision = views.get(a)!.revision; await table.pages[2]!.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    await passUntil(table, views, game => game.activeWindow?.kind === 'attack-abilities', 500);
    await expect(table.pages[0]!.getByRole('button', { name: '竜殺槍を使う', exact: true })).toHaveCount(0);
    const done = await passUntil(table, views, game => !game.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(0); expect(done.players[b]!.followers).toEqual([{ position: 0, face: 'front', cardInstanceId: 'a2-p22-r3c1' }]);
    expect((await storedDiscard())).toContain('a2-p02-r2c3');
  } finally { await table.close(); }
});
test('White Sword reserves both clauses once and keeps Gadyoora target damage through reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'destroy-lancelot');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id;
    await useAbility(table, views, 0, '白龍の剣');
    expect(views.get(b)!.game!.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
    expect(JSON.stringify(views.get(b)!.game)).not.toContain('c2-p02-r2c2-ab02');
    await table.pages[0]!.reload(); await expect(table.pages[0]!.getByRole('region', { name: '現在の行動' })).toContainText('白龍の剣');
    const defense = await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense', 500);
    expect(defense.currentAttack!.targets[0]!.hits[0]!.technique!.damage).toBe(14);
    await expect(table.pages[0]!.getByRole('region', { name: '従者への攻撃と結果' })).toContainText('ダメージ 14');
    const reached = await passUntil(table, views, game => game.followerDefenseResults.length > 0, 500);
    expect(reached.followerDefenseResults).toMatchObject([{ cardInstanceId: 'a2-p21-r1c1', hits: [{ outcome: 'attribute-destroyed', hpReduction: 0 }] }]);
    await table.pages[1]!.reload(); await expect(table.pages[1]!.getByRole('region', { name: '従者への攻撃と結果' })).toContainText('ワイト');
    const done = await passUntil(table, views, game => !game.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(14); expect(done.players[b]!.followers).toEqual([]);
    expect((await storedDiscard())).toContain('a2-p21-r1c1');
  } finally { await table.close(); }
});
for (const blessed of [false, true]) test(`Asfelt uses effective follower level with Blessing=${blessed} and protects an unreached rear`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, blessed ? 'destroy-asfelt-blessing' : 'destroy-asfelt');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id;
    await useAbility(table, views, 0, '風龍の剣');
    const reached = await passUntil(table, views, game => game.followerDefenseResults.length > 0, 500);
    expect(reached.followerDefenseResults).toHaveLength(blessed ? 1 : 2);
    expect(reached.followerDefenseResults[0]).toMatchObject({ cardInstanceId: 'a2-p22-r1c1', hits: [{ outcome: blessed ? 'blocked' : 'level-destroyed', hpReduction: 0 }] });
    if (blessed) expect(JSON.stringify(views.get(a)!.game)).not.toContain('a2-p18-r3c3');
    await table.pages[0]!.reload();
    const panel = table.pages[0]!.getByRole('region', { name: '従者への攻撃と結果' });
    await expect(panel).toContainText('メタルゴーレム');
    await expect(panel).toContainText(blessed ? '防御成功' : '効果による破壊');
    if (blessed) await expect(panel).not.toContainText('兵士');
    const done = await passUntil(table, views, game => !game.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(blessed ? 0 : 7); expect(done.players[b]!.followers).toHaveLength(blessed ? 2 : 0);
    if (blessed) expect(done.players[b]!.followers[1]).toEqual({ position: 1, face: 'back' });
  } finally { await table.close(); }
});
test('Frenzy destroys the explicitly chosen virtual guard and physical human with no extra physical card', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'destroy-frenzy');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id;
    await useAbility(table, views, 0, '狂魂');
    await passUntil(table, views, game => game.activeWindow?.kind === 'follower-entry-abilities' && game.activeWindow.pendingActorId === b, 500);
    await useAbility(table, views, 1, '女性親衛隊');
    const frozen = await passUntil(table, views, game => game.activeWindow?.kind === 'follower-start', 500);
    expect(frozen.virtualFollowerDefense).toHaveLength(1); expect(frozen.followerDefenseResults).toEqual([]);
    await table.pages[1]!.reload(); await expect(table.pages[1]!.getByRole('region', { name: '従者防御の準備' })).toContainText('物理の札は増えません');
    const reached = await passUntil(table, views, game => game.followerDefenseResults.length === 2, 500);
    expect(reached.followerDefenseResults).toMatchObject([
      { source: 'virtual', position: -1, hits: [{ outcome: 'attribute-destroyed', hpReduction: 0 }] },
      { source: 'physical', cardInstanceId: 'a2-p18-r3c3', hits: [{ outcome: 'attribute-destroyed', hpReduction: 0 }] },
    ]);
    await expect(table.pages[1]!.getByRole('region', { name: '従者への攻撃と結果' })).toContainText('仮想女性親衛隊');
    const done = await passUntil(table, views, game => !game.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(5); expect(done.players[b]!.followers).toEqual([]); expect(done.virtualFollowerDefense).toEqual([]);
    expect((await storedDiscard())).toContain('a2-p18-r3c3'); expect((await storedDiscard()).every(id => !id.includes('virtual'))).toBe(true);
  } finally { await table.close(); }
});
