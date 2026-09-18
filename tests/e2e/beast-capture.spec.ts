import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture, windowPassButtonName,storedDiscard} from './helpers.js';
import type { PlayerView } from '../../packages/engine/src/index.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
const griffin = 'a2-p20-r3c1'; const wyvern = 'a2-p22-r3c1';
async function use(table: Table, views: Views) {
  const actor = table.sessions[0]!.id; const revision = views.get(actor)!.revision;
  await table.pages[0]!.getByRole('button', { name: '獣共感を使う', exact: true }).click();
  await expect.poll(() => views.get(actor)?.revision).toBeGreaterThan(revision);
}
async function passWithoutBeastCapture(table: Table, views: Views, done: (game: PlayerView) => boolean, maxSteps = 500) {
  const owner = table.sessions[0]!.id;
  for (let i = 0; i < maxSteps; i++) {
    const current = views.get(owner)!; const game = current.game!;
    for (const view of views.values()) {
      expect(view.game?.activeWindow?.kind).not.toBe('beast-capture');
      expect(view.game?.beastCapture).toBeNull();
    }
    if (done(game)) return game;
    const window = game.activeWindow; expect(window).not.toBeNull();
    const page = table.pages[table.sessions.findIndex(session => session.id === window!.pendingActorId)]!;
    await expect(page.getByRole('complementary', { name: '獣の取得' })).toHaveCount(0);
    await page.getByRole('button', { name: windowPassButtonName }).click();
    await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(current.revision);
  }
  throw Error('Beast-capture negative path did not reach its expected boundary');
}
test('Upa can decline beast ignore without revealing or acquiring the blocked rear', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'beast-capture');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id;
    await expect(table.pages[0]!.getByRole('button', { name: '獣共感を使う', exact: true })).toBeVisible();
    const done = await passWithoutBeastCapture(table, views, game => !game.activeWindow);
    expect(done.players[b]!.damage).toBe(0); expect(done.players[b]!.followers).toEqual([{ position: 0, face: 'back' }]);
    expect(done.beastCapture).toBeNull(); expect((await storedDiscard())).toContain(griffin); expect(done.self.hand).not.toContain(wyvern);
    await expect(table.pages[0]!.getByRole('complementary', { name: '獣の取得' })).toHaveCount(0);
  } finally { await table.close(); }
});
test('earned capture survives reload and offers only the owner an unchecked subset of actual beasts', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'beast-capture');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    await use(table, views);
    expect(views.get(c)!.game!.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
    expect(JSON.stringify(views.get(c)!.game)).not.toContain('獣共感');
    await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense', 500);
    await expect(table.pages[2]!.getByRole('region', { name: '従者への攻撃と結果' })).toContainText('獣属性の従者を無視');
    expect(JSON.stringify(views.get(c)!.game)).not.toContain(wyvern);
    const earned = await passUntil(table, views, game => game.activeWindow?.kind === 'beast-capture', 500);
    expect(earned.players[b]!.damage).toBe(7); const savedChoice = earned.beastCapture;
    await table.pages[0]!.reload();
    const panel = table.pages[0]!.getByRole('complementary', { name: '獣の取得' });
    await expect(panel).toBeVisible(); expect(views.get(a)!.game!.beastCapture).toEqual(savedChoice);
    await expect(panel.getByRole('checkbox')).toHaveCount(2);
    await expect(panel.getByRole('checkbox').nth(0)).not.toBeChecked(); await expect(panel.getByRole('checkbox').nth(1)).not.toBeChecked();
    await expect(panel.getByRole('button', { name: '選んだ獣を手札に加える' })).toBeDisabled();
    const otherPanel = table.pages[2]!.getByRole('complementary', { name: '獣の取得' });
    await expect(otherPanel).toContainText('葵さんの判断を待っています'); await expect(otherPanel).not.toContainText('飛竜');
    await expect(otherPanel.getByRole('checkbox')).toHaveCount(0); expect(views.get(c)!.game!.beastCapture).toBeNull();
    await panel.getByRole('checkbox', { name: /楓さんの2番目：飛竜/ }).check();
    const revision = views.get(a)!.revision;
    await panel.getByRole('button', { name: '選んだ獣を手札に加える' }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    await expect(panel).toHaveCount(0); expect(views.get(a)!.game!.self.hand.filter(id => id === wyvern)).toHaveLength(1);
    expect(views.get(a)!.game!.players[b]!.followers).toEqual([{ position: 0, face: 'back' }]);
    await expect(table.pages[2]!.getByRole('region', { name: '公開ログ' })).toContainText('楓さんから獣を1枚手札に加えました');
    expect(JSON.stringify(views.get(c)!.game)).not.toContain(wyvern); expect(JSON.stringify(views.get(c)!.game)).not.toContain(griffin);
    await table.pages[0]!.reload(); await expect(table.pages[0]!.getByRole('region', { name: '自分の手札' })).toContainText('飛竜');
    expect(views.get(a)!.game!.beastCapture).toBeNull(); expect(views.get(a)!.game!.self.hand.filter(id => id === wyvern)).toHaveLength(1);
  } finally { await table.close(); }
});
test('choosing ignore does not force acquisition when the saved capture decision is declined', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'beast-capture');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id;
    await use(table, views); await passUntil(table, views, game => game.activeWindow?.kind === 'beast-capture', 500);
    await table.pages[0]!.reload(); const panel = table.pages[0]!.getByRole('complementary', { name: '獣の取得' });
    await expect(panel).toBeVisible(); const hand = [...views.get(a)!.game!.self.hand]; const revision = views.get(a)!.revision;
    await panel.getByRole('button', { name: '奪わずに進む' }).click(); await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    expect(views.get(a)!.game!.self.hand).toEqual(hand); expect(views.get(a)!.game!.players[b]!.damage).toBe(7);
    expect(views.get(a)!.game!.players[b]!.followers).toEqual([{ position: 0, face: 'back' }, { position: 1, face: 'back' }]);
    await expect(panel).toHaveCount(0);
  } finally { await table.close(); }
});
test('a third party can cancel beast ignore after reload and spends the sole attempt', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'beast-capture');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    await use(table, views); await passUntil(table, views, game => game.activeWindow?.pendingActorId === c && !!game.reactionTargetAbilityId, 500);
    await table.pages[2]!.reload(); await table.pages[2]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    const revision = views.get(a)!.revision; await table.pages[2]!.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    await passWithoutBeastCapture(table, views, game => game.activeWindow?.kind === 'attack-abilities');
    await expect(table.pages[0]!.getByRole('button', { name: '獣共感を使う', exact: true })).toHaveCount(0);
    const done = await passWithoutBeastCapture(table, views, game => !game.activeWindow);
    expect(done.players[b]!.damage).toBe(0); expect(done.beastCapture).toBeNull(); expect((await storedDiscard())).toContain('a2-p02-r2c3');
  } finally { await table.close(); }
});
for (const scenario of ['beast-capture-no-beasts', 'beast-capture-guard', 'beast-capture-blocked'] as const) test(`${scenario} prevents capture through the actual follower defense`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, scenario);
  try {
    const views = await observe(table); const b = table.sessions[1]!.id;
    await use(table, views);
    if (scenario === 'beast-capture-blocked') {
      const reached = await passWithoutBeastCapture(table, views, game => game.followerDefenseResults.length > 0);
      expect(reached.followerDefenseResults).toMatchObject([{ cardInstanceId: 'a2-p22-r1c1', hits: [{ outcome: 'blocked' }] }]);
      for (const index of [0, 2, 3]) {
        await expect.poll(() => views.get(table.sessions[index]!.id)?.game?.followerDefenseResults.length).toBeGreaterThan(0);
        const publicView = views.get(table.sessions[index]!.id)!.game!; const json = JSON.stringify(publicView);
        expect(json).not.toContain(wyvern); expect(json).not.toContain('飛竜');
        const summary = table.pages[index]!.getByRole('region', { name: '従者への攻撃と結果' });
        await expect(summary).toContainText('メタルゴーレム'); await expect(summary).not.toContainText('飛竜');
      }
    }
    const done = await passWithoutBeastCapture(table, views, game => !game.activeWindow);
    expect(done.players[b]!.damage).toBe(0); expect(done.beastCapture).toBeNull();
    expect(done.logs.some(event => event.type === 'BEAST_CAPTURED')).toBe(false);
    if (scenario === 'beast-capture-blocked') {
      expect(done.players[b]!.followers[1]).toEqual({ position: 1, face: 'back' });
      for (const index of [0, 2, 3]) {
        await expect.poll(() => views.get(table.sessions[index]!.id)?.game?.activeWindow).toBeNull();
        const publicView = views.get(table.sessions[index]!.id)!.game!; const json = JSON.stringify(publicView);
        expect(json).not.toContain(wyvern); expect(json).not.toContain('飛竜');
        const target = table.pages[index]!.getByRole('article').filter({ has: table.pages[index]!.getByRole('heading', { name: '楓', exact: true }) });
        await expect(target).not.toContainText('飛竜');
      }
    }
    await expect(table.pages[0]!.getByRole('complementary', { name: '獣の取得' })).toHaveCount(0);
  } finally { await table.close(); }
});
test('lethal capture restores before the victim can gift and disposes only the remaining beast', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'beast-capture-lethal');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const d = table.sessions[3]!.id;
    await use(table, views); const earned = await passUntil(table, views, game => game.activeWindow?.kind === 'beast-capture', 500);
    expect(earned.players[b]!.presence).toBe('pending-death'); expect(earned.outcome).toBeNull();
    await expect(table.pages[1]!.getByRole('complementary', { name: '死亡時の贈与' })).toHaveCount(0);
    await table.pages[0]!.reload(); const panel = table.pages[0]!.getByRole('complementary', { name: '獣の取得' });
    await panel.getByRole('checkbox', { name: /グリフォン/ }).check(); const revision = views.get(a)!.revision;
    await panel.getByRole('button', { name: '選んだ獣を手札に加える' }).click(); await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    // Resolve the remaining reclaim/lifecycle responses before the victim's gift window.
    await passUntil(table, views, game => game.activeWindow?.kind === 'death-gift', 500);
    await table.pages[1]!.reload(); const gift = table.pages[1]!.getByRole('complementary', { name: '死亡時の贈与' });
    await expect(gift).toBeVisible(); expect(views.get(b)!.game!.self.followers.map(card => card.cardInstanceId)).toEqual([wyvern]);
    await gift.getByRole('combobox', { name: '死亡時に使うカード' }).selectOption('a2-p02-r3c3');
    await gift.getByRole('combobox', { name: '相手に託す手札' }).selectOption('a2-p05-r2c3');
    await gift.getByRole('combobox', { name: 'カードを託す相手' }).selectOption(d);
    const beforeGift = views.get(a)!.revision; await gift.getByRole('button', { name: '選んだ手札を託す' }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(beforeGift);
    const done = await passUntil(table, views, game => !!game.outcome, 500);
    expect(done.players[b]!.presence).toBe('dead'); expect(done.self.hand.filter(id => id === griffin)).toHaveLength(1);
    expect((await storedDiscard())).not.toContain(griffin); expect((await storedDiscard()).filter(id => id === wyvern)).toHaveLength(1);
    expect(views.get(d)!.game!.self.hand).toContain('a2-p05-r2c3');
    await table.pages[0]!.reload(); await expect(table.pages[0]!.getByRole('region', { name: '自分の手札' })).toContainText('グリフォン');
    expect(views.get(a)!.game!.beastCapture).toBeNull(); expect(views.get(a)!.game!.outcome).not.toBeNull();
  } finally { await table.close(); }
});
