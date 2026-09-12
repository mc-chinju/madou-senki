import type {Browser,APIRequestContext} from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { PlayerView } from '../../packages/engine/src/index.js';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { observe, passUntil, tableFixture } from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Map<string, RoomView>;
function entry(game: PlayerView, actorId: string, targetId: string) {
  return game.activeWindow?.kind === 'follower-entry-abilities' && game.activeWindow.pendingActorId === actorId && game.followerEntry?.targetId === targetId;
}
async function useAbility(table: Table, views: Views, index: number, name: string) {
  const owner = table.sessions[0]!.id; const revision = views.get(owner)!.revision;
  await table.pages[index]!.getByRole('button', { name: `${name}を使う`, exact: true }).click();
  await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
}
async function chooseEffect(table: Table, views: Views, id: string) {
  const own = views.get(table.sessions[0]!.id)!.game!;
  const option = own.abilityOptions.find(option => option.abilityId === 'c2-p03-r2c1-ab02')!.effectOptions!.find(effect => effect.id === id)!;
  await table.pages[0]!.getByRole('checkbox', { name: option.name, exact: true }).check();
}
async function verifyGuard(browser:Browser,request:APIRequestContext,selected:boolean){
  const table = await tableFixture(browser, request, 'entry-arnes');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id;
    let virtualId:string|undefined;
    await passUntil(table, views, game => entry(game, b, b), 400);
    const panel = table.pages[1]!.getByRole('region', { name: '従者防御の準備' });
    await expect(panel).toContainText('通常防御へは戻れません');
    expect(views.get(b)!.game!.legalChoices).not.toContain('PLAY_DEFENSE');
    expect(views.get(a)!.game!.virtualFollowerDefense).toEqual([]);
    if (selected) await useAbility(table, views, 1, '女性親衛隊');
    const frozen = await passUntil(table, views, game => game.activeWindow?.kind === 'follower-start', 400);
    expect(frozen.players[b]!.followers).toHaveLength(0);
    if (selected) {
      const guard = frozen.virtualFollowerDefense[0]!; virtualId=guard.sourceId;
      expect(guard).toMatchObject({ source: 'virtual', targetId: b, levels: [4, 4, 4], hp: 1, moraleRequired: false });
      expect(JSON.stringify(views.get(a)!.game)).not.toContain('c2-p03-r2c2');
      await table.pages[1]!.reload(); await expect(panel).toContainText('物理の札は増えません');
      expect(views.get(b)!.game!.virtualFollowerDefense[0]!.sourceId).toBe(guard.sourceId);
      const resolved = await passUntil(table, views, game => game.virtualFollowerDefense[0]?.hits.length === 3, 400);
      expect(resolved.virtualFollowerDefense[0]!.hits.map(hit => hit.hpReduction)).toEqual([1, 1, 1]);
      await expect(panel).toContainText('3発目（HP軽減 1）');
    } else expect(frozen.virtualFollowerDefense).toEqual([]);
    const done = await passUntil(table, views, game => !game.activeWindow, 400);
    expect(done.players[b]!.damage).toBe(selected ? 15 : 18); expect(done.virtualFollowerDefense).toEqual([]);
    expect(done.players[b]!.followers).toEqual([]);
    if(selected){expect(virtualId).toBeTruthy();for(const [seat,page] of table.pages.entries()){await page.reload();const own=views.get(table.sessions[seat]!.id)!.game!;expect(own.self.hand).not.toContain(virtualId);expect(own.discard).not.toContain(virtualId);expect(own.reservedCards).toEqual([]);expect(own.reclaim).toBeNull();}}
  } finally { await table.close(); }
}
test('Arnes explicitly declines virtual defense for three real hits',async({browser,request})=>{await verifyGuard(browser,request,false);});
test('S29 Arnes explicitly selects virtual defense for three real hits without adding a physical card',async({browser,request})=>{await verifyGuard(browser,request,true);});
test('a third party cancels virtual guard after reload and the original three hits continue', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'entry-arnes-cancel');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    await passUntil(table, views, game => entry(game, b, b), 400); await useAbility(table, views, 1, '女性親衛隊');
    await passUntil(table, views, game => game.activeWindow?.pendingActorId === c && !!game.reactionTargetAbilityId, 400);
    await table.pages[2]!.reload(); await table.pages[2]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    const revision = views.get(a)!.revision; await table.pages[2]!.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    const done = await passUntil(table, views, game => !game.activeWindow, 400);
    expect(done.players[b]!.damage).toBe(18); expect(done.virtualFollowerDefense).toEqual([]); expect(done.discard).toContain('a2-p02-r2c3');
  } finally { await table.close(); }
});
test('Lester chooses spirit conversion explicitly and keeps the original warrior technique after reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'entry-lester-spirit');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[0]!;
    const panel = page.getByRole('region', { name: '使える特殊能力' });
    await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: '幻術を使う', exact: true })).toBeDisabled();
    await chooseEffect(table, views, 'spirit-conversion'); await useAbility(table, views, 0, '幻術');
    await page.reload(); await expect(page.getByRole('region', { name: '現在の行動' })).toContainText('選んだ効果: 技の精神化');
    expect(views.get(b)!.game!.currentAction).not.toHaveProperty('abilityEffectIds');
    const defense = await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense', 400);
    expect(defense.currentAction).toMatchObject({ source: 'card', technique: { school: 'warrior', attributes: expect.arrayContaining(['剣', '精']), effectLevel: 5, damage: 7 } });
    await expect(page.getByRole('region', { name: '現在の行動' })).toContainText('戦士技');
    const done = await passUntil(table, views, game => !game.activeWindow, 400);
    expect(done.players[b]!.damage).toBe(7); expect(views.get(b)!.game!.self.followers.map(card => card.cardInstanceId)).toContain('a2-p19-r2c3');
    expect(done.players[a]!.damage).toBe(0);
  } finally { await table.close(); }
});
for (const revealed of [false, true]) test(`Lester human invalidation preserves physical cards and virtual suppression respects revealed=${revealed}`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, revealed ? 'entry-lester-revealed' : 'entry-lester-hidden');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id;
    const physical = views.get(b)!.game!.self.followers.map(card => card.cardInstanceId);
    await chooseEffect(table, views, 'human-invalidation'); await chooseEffect(table, views, 'arnes-suppression'); await useAbility(table, views, 0, '幻術');
    await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense', 400);
    await table.pages[1]!.getByLabel('女性親衛隊の専用効果を使う').check();
    const revision = views.get(a)!.revision; await table.pages[1]!.getByRole('button', { name: '従者で受ける', exact: true }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    await passUntil(table, views, game => entry(game, b, b), 400);
    if (views.get(b)!.game!.abilityOptions.some(option => option.abilityId === 'c2-p03-r2c2-ab02')) await useAbility(table, views, 1, '女性親衛隊');
    else expect(revealed).toBe(true);
    const frozen = await passUntil(table, views, game => game.activeWindow?.kind === 'follower-start', 400);
    expect(frozen.virtualFollowerDefense).toHaveLength(revealed ? 0 : 1);
    await table.pages[1]!.reload(); await expect(table.pages[1]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
    expect(views.get(b)!.game!.virtualFollowerDefense).toHaveLength(revealed ? 0 : 1);
    const done = await passUntil(table, views, game => !game.activeWindow, 400);
    expect(done.players[b]!.damage).toBe(revealed ? 7 : 6);
    expect(views.get(b)!.game!.self.followers.map(card => card.cardInstanceId)).toEqual(physical);
  } finally { await table.close(); }
});
test('Tia chooses a separate advance for each target and virtual guard still cancels follower ignore after reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'entry-tia');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    const distances = views.get(a)!.game!.distances;
    await passUntil(table, views, game => entry(game, a, b), 400);
    await expect(table.pages[0]!.getByRole('button', { name: '奇襲を使う', exact: true })).toBeDisabled();
    await table.pages[0]!.getByLabel('消費する踏み込み').selectOption('a2-p23-r1c2'); await useAbility(table, views, 0, '奇襲');
    // The paid advance opens reclaim responses before the ability declaration.
    await passUntil(table, views, game => game.currentAction?.source === 'ability' && game.currentAction.abilityId === 'c2-p02-r1c1-ab02', 400);
    await table.pages[0]!.reload(); await expect(table.pages[0]!.getByRole('region', { name: '現在の行動' })).toContainText('奇襲');
    expect(views.get(a)!.game!.self.hand).not.toContain('a2-p23-r1c2');
    await passUntil(table, views, game => entry(game, b, b), 400); await useAbility(table, views, 1, '女性親衛隊');
    await passUntil(table, views, game => entry(game, a, c), 400);
    await table.pages[0]!.getByLabel('消費する踏み込み').selectOption('a2-p23-r1c3'); await useAbility(table, views, 0, '奇襲');
    const done = await passUntil(table, views, game => !game.activeWindow, 400);
    expect(done.players[b]!.damage).toBe(5); expect(done.players[c]!.damage).toBe(7);
    expect(views.get(c)!.game!.self.followers.map(card => card.cardInstanceId)).toEqual(['a2-p20-r3c1']);
    expect(done.discard).toEqual(expect.arrayContaining(['a2-p23-r1c2', 'a2-p23-r1c3'])); expect(done.distances).toEqual(distances);
  } finally { await table.close(); }
});
