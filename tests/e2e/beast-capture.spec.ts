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