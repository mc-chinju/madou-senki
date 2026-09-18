import { expect, test } from '@playwright/test';
import type { PlayerView } from '../../packages/engine/src/index.js';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Map<string, RoomView>;
async function clickAbility(table: Table, views: Views, name: string) {
  const a = table.sessions[0]!.id; const before = views.get(a)!.revision;
  await table.pages[0]!.getByRole('button', { name: `${name}を使う`, exact: true }).click();
  await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(before);
}
async function reaction(table: Table, views: Views, card: string, mode: string, dedicated = false) {
  const a = table.sessions[0]!.id; const panel = table.pages[2]!.getByRole('complementary', { name: '現在の判断' });
  await panel.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption(mode);
  if (dedicated) await panel.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
  await panel.getByRole('combobox', { name: '使うカード', exact: true }).selectOption(card);
  const before = views.get(a)!.revision;
  await panel.getByRole('button', { name: '割り込みを使う', exact: true }).click();
  await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(before);
}
function at(game: PlayerView, kind: string, actorId?: string) {
  return game.activeWindow?.kind === kind && (!actorId || game.activeWindow.pendingActorId === actorId);
}
for (const selected of [false, true]) test(`Shelim staff is explicitly selected=${selected} and preserves usage and damage across reload`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'value-staff');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[0]!;
    const summary = page.getByRole('region', { name: '現在の行動' });
    await expect(summary).toContainText('効果値 5（計算中）');
    await expect(page.getByRole('button', { name: '賢者の杖を使う', exact: true })).toBeEnabled();
    if (selected) {
      await clickAbility(table, views, '賢者の杖'); await page.reload();
      await expect(page.getByRole('region', { name: '計算中の技', exact: true })).toContainText('白光');
      expect(views.get(b)!.game!.currentAction).not.toHaveProperty('abilityId');
    }
    const defense = await passUntil(table, views, game => at(game, 'normal-defense'), 400);
    expect(defense.currentAction).toMatchObject({ technique: { useLevel: 5, effectLevel: selected ? 6 : 5, damage: 6, calculation: { effectLevel: 'final', damage: 'final' } } });
    await expect(summary).toContainText(`効果値 ${selected ? 6 : 5}（確定）`);
    await expect(page.getByRole('region', { name: '計算中の技', exact: true })).toHaveCount(0);
    const done = await passUntil(table, views, game => !game.activeWindow, 400); expect(done.players[b]!.damage).toBe(6);
  } finally { await table.close(); }
});
test('Lamba chooses Axe only during damage calculation and doubles the declared qualifying warrior technique', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'value-axe');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[0]!;
    await expect(page.getByRole('button', { name: '斧使いを使う', exact: true })).toHaveCount(0);
    await passUntil(table, views, game => at(game, 'damage', a), 400); await clickAbility(table, views, '斧使い');
    await page.reload(); await expect(page.getByRole('region', { name: '計算中の技', exact: true })).toContainText('黒翼飛翔剣');
    const defense = await passUntil(table, views, game => at(game, 'normal-defense'), 400);
    expect(defense.currentAction).toMatchObject({ technique: { useLevel: 5, effectLevel: 5, damage: 14 } });
    await expect(page.getByRole('region', { name: '現在の行動' })).toContainText('ダメージ 14（確定）');
    const done = await passUntil(table, views, game => !game.activeWindow, 400); expect(done.players[b]!.damage).toBe(14);
  } finally { await table.close(); }
});
test('Shin uses an unmodified spirit check and cannot request a late effect bonus after defense begins', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'value-spirit');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[0]!;
    await clickAbility(table, views, '気合い');
    const before = await passUntil(table, views, game => game.currentRoll?.purpose === 'ability-check' && at(game, 'before-roll'), 400);
    expect(before.currentRoll).toMatchObject({ formula: '2d6', modifier: 0 });
    await page.reload(); await expect(page.getByRole('region', { name: '計算中の技', exact: true })).toContainText('効果Lv 5（計算中）');
    const defense = await passUntil(table, views, game => at(game, 'normal-defense'), 400);
    expect(defense.currentAction).toMatchObject({ technique: { useLevel: 5, effectLevel: 6, damage: 7 } });
    expect(defense.recentRolls.find(roll => roll.purpose === 'ability-check')).toMatchObject({ modifier: 0, success: true });
    expect(views.get(b)!.game!.recentRolls.find(roll => roll.purpose === 'ability-check')).not.toHaveProperty('threshold');
    await expect(page.getByRole('button', { name: '気合いを使う', exact: true })).toHaveCount(0);
    const done = await passUntil(table, views, game => !game.activeWindow, 400); expect(done.players[b]!.damage).toBe(7);
  } finally { await table.close(); }
});
test('Fate cancels Shin after reload without a check or repeat opportunity', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'value-spirit');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    await clickAbility(table, views, '気合い');
    await passUntil(table, views, game => !!game.reactionTargetAbilityId && game.activeWindow?.pendingActorId === c, 400);
    await table.pages[2]!.reload(); await reaction(table, views, 'a2-p02-r2c3', 'cancel-ability');
    await passUntil(table, views, game => at(game, 'effect-level', a), 400);
    await expect(table.pages[0]!.getByRole('button', { name: '気合いを使う', exact: true })).toHaveCount(0);
    const defense = await passUntil(table, views, game => at(game, 'normal-defense'), 400);
    expect(defense.currentAction).toMatchObject({ technique: { effectLevel: 5, damage: 7 } });
    expect(defense.recentRolls.some(roll => roll.purpose === 'ability-check')).toBe(false);
    const done = await passUntil(table, views, game => !game.activeWindow, 400); expect(done.players[b]!.damage).toBe(7); expect((await storedDiscard())).toContain('a2-p02-r2c3');
  } finally { await table.close(); }
});
test('Jill composes a real Lia prayer and rerolls only the independent Fist die with the parent visible', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const table = await tableFixture(browser, request, 'value-fist');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    await clickAbility(table, views, '鉄拳');
    await passUntil(table, views, game => at(game, 'effect-level', c), 400);
    await reaction(table, views, 'a2-p05-r2c3', 'effect-plus', true);
    const prayer = await passUntil(table, views, game => game.currentRoll?.purpose === 'prayer-addition', 400);
    const addition = prayer.currentRoll!.total!;
    await table.pages[2]!.reload(); await expect(table.pages[2]!.getByRole('region', { name: '計算中の技', exact: true })).toContainText('狼牙');
    const damage = await passUntil(table, views, game => at(game, 'damage'), 400);
    expect(damage.currentAction).toMatchObject({ technique: { useLevel: 5, effectLevel: 6 + addition, calculation: { effectLevel: 'final', damage: 'pending' } } });
    const native = (await passUntil(table, views, game => game.currentRoll?.purpose === 'attack-damage', 400)).currentRoll!;
    expect(native.formula).toBe('2d6'); expect(native.faces).toHaveLength(2);
    const bonus = (await passUntil(table, views, game => game.currentRoll?.purpose === 'ability-value' && game.activeWindow?.pendingActorId === c, 400)).currentRoll!;
    expect(bonus.formula).toBe('d6'); expect(bonus.rollId).not.toBe(native.rollId);
    const decision = table.pages[2]!.getByRole('complementary', { name: '現在の判断' });
    await expect(decision.locator('option[value="force-fail"]')).toHaveCount(0);
    await reaction(table, views, 'a2-p02-r1c3', 'reroll'); await table.pages[2]!.reload();
    await expect(table.pages[2]!.getByRole('region', { name: '計算中の技', exact: true })).toContainText(`効果Lv ${6 + addition}（確定）`);
    const rerolled = (await passUntil(table, views, game => game.currentRoll?.rollId === bonus.rollId && game.currentRoll.generation === 1, 400)).currentRoll!;
    expect(rerolled.faces).toHaveLength(1); expect(rerolled.attempts).toHaveLength(2);
    const defense = await passUntil(table, views, game => at(game, 'normal-defense'), 400); const total = native.total! + rerolled.total!;
    expect(defense.currentAction).toMatchObject({ technique: { effectLevel: 6 + addition, damage: total } });
    expect(defense.recentRolls.find(roll => roll.rollId === native.rollId)?.faces).toEqual(native.faces);
    const done = await passUntil(table, views, game => !game.activeWindow, 400); expect(done.players[b]!.damage).toBe(total);
    await table.pages[0]!.reload(); await expect(table.pages[0]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
    expect(views.get(a)!.game!.recentRolls.find(roll => roll.rollId === bonus.rollId)?.attempts).toHaveLength(2);
  } finally { await table.close(); }
});
test('Uonos rerolls a separate black-magic effect die without changing printed usage or damage', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'value-black-magic');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    await clickAbility(table, views, '破壊神の力');
    const original = (await passUntil(table, views, game => game.currentRoll?.purpose === 'ability-value' && game.activeWindow?.pendingActorId === c, 400)).currentRoll!;
    expect(original.formula).toBe('d6');
    await expect(table.pages[2]!.getByRole('complementary', { name: '現在の判断' }).locator('option[value="force-fail"]')).toHaveCount(0);
    await reaction(table, views, 'a2-p02-r1c3', 'reroll'); await table.pages[0]!.reload();
    await expect(table.pages[0]!.getByRole('region', { name: '計算中の技', exact: true })).toContainText('妖獣');
    const rerolled = (await passUntil(table, views, game => game.currentRoll?.rollId === original.rollId && game.currentRoll.generation === 1, 400)).currentRoll!;
    const defense = await passUntil(table, views, game => at(game, 'normal-defense'), 400);
    expect(defense.currentAction).toMatchObject({ technique: { useLevel: 4, effectLevel: 4 + rerolled.total!, damage: 5 } });
    expect(JSON.stringify(views.get(b)!.game)).not.toContain('c2-p05-r1c1');
    const done = await passUntil(table, views, game => !game.activeWindow, 400); expect(done.players[b]!.damage).toBe(5);
    expect(done.recentRolls.find(roll => roll.rollId === original.rollId)?.attempts).toHaveLength(2);
  } finally { await table.close(); }
});
