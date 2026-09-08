import { expect, test } from '@playwright/test';
import { getAction } from '../../packages/catalog/src/index.js';
import { observe, passUntil, tableFixture } from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
function game(table: Table, views: Views, seat = 0) { return views.get(table.sessions[seat]!.id)!.game!; }
function maais(table: Table, views: Views, seat: number) { return game(table, views, seat).self.hand.filter(id => getAction(id)?.modes?.some(mode => mode.playMode === 'distance')); }
async function click(table: Table, views: Views, seat: number, label: string) {
  const a = table.sessions[0]!.id; const revision = views.get(a)!.revision;
  await table.pages[seat]!.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
}
async function card(table: Table, views: Views, seat: number, cardId: string, label: string) {
  await table.pages[seat]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption(cardId);
  await click(table, views, seat, label);
}
async function normal(table: Table, views: Views) { return passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500); }

for (const selected of [false, true]) test(`Lancaster selected=${selected} displays actual maai progress and resumes paid cards after reload`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'property-lancaster');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id;
    await expect(table.pages[0]!.getByRole('button', { name: '瞬風を使う', exact: true })).toBeVisible();
    if (selected) await click(table, views, 0, '瞬風を使う');
    await normal(table, views); const cards = maais(table, views, 1); const required = selected ? 3 : 2;
    const panel = table.pages[1]!.getByRole('region', { name: '間合いの状況' });
    await expect(panel).toContainText(`必要${required}枚・有効0枚・あと${required}枚`);
    for (let i = 0; i < 2; i++) await card(table, views, 1, cards[i]!, '間合いを使う');
    if (selected) {
      await table.pages[1]!.reload();
      await expect(panel).toContainText('必要3枚・有効2枚・あと1枚');
      expect(game(table, views).activeWindow?.pendingActorId).toBe(b);
      await card(table, views, 1, cards[2]!, '間合いを使う');
      await expect(panel).toContainText('回避はまだ確定していません');
      const advance = game(table, views).self.hand.find(id => getAction(id)?.name === '踏み込み／殴る')!;
      await card(table, views, 0, advance, '踏み込みを使う');
      await expect(panel).toContainText('必要3枚・有効2枚・あと1枚');
      await click(table, views, 0, 'パス'); await table.pages[1]!.reload();
      await expect(panel).toContainText('前の応酬から有効な間合い2枚、今回出した間合い0枚');
      await card(table, views, 1, cards[3]!, '間合いを使う');
    }
    expect(game(table, views).activeWindow?.kind).toBe('defense-advance'); await click(table, views, 0, 'パス');
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(0); expect(done.maaiDefense).toBeNull(); await expect(panel).toHaveCount(0);
    for (const id of cards.slice(0, selected ? 4 : 2)) expect(done.discard.filter(card => card === id)).toHaveLength(1);
  } finally { await table.close(); }
});

for (const selected of [false, true]) test(`Black Bow selected=${selected} updates all printed package values and the actual evasion controls`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'property-arnes');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id;
    await expect(table.pages[0]!.getByRole('button', { name: '黒弓を使う', exact: true })).toBeVisible();
    if (selected) {
      await click(table, views, 0, '黒弓を使う');
      for (const seat of [1, 2, 3]) { expect(JSON.stringify(game(table, views, seat))).not.toContain('黒弓'); expect(JSON.stringify(game(table, views, seat))).not.toContain('c2-p03-r2c2-ab03'); }
    }
    await normal(table, views); await table.pages[1]!.reload();
    const panel = table.pages[1]!.getByRole('complementary', { name: '現在の判断' });
    await expect(panel).toBeVisible();
    expect(game(table, views).currentAttack!.technique).toMatchObject({ effectLevel: selected ? 6 : 5, damage: selected ? 12 : 10 });
    if (selected) {
      await expect(panel).toContainText('見切り不可'); await expect(panel.getByRole('option', { name: '見切る', exact: true })).toHaveCount(0);
    } else {
      await expect(panel).not.toContainText('見切り不可');
      const evade = game(table, views, 1).self.hand.find(id => getAction(id)?.name === '見切る')!;
      await card(table, views, 1, evade, '防御する');
    }
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(selected ? 12 : 0);
  } finally { await table.close(); }
});

for (const scenario of ['property-lancaster', 'property-arnes'] as const) test(`${scenario} can be canceled after reload and cannot reuse the spent ability`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, scenario);
  try {
    const views = await observe(table); const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    const name = scenario === 'property-arnes' ? '黒弓' : '瞬風';
    await click(table, views, 0, `${name}を使う`);
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === c && !!state.reactionTargetAbilityId, 500);
    await table.pages[2]!.reload(); await card(table, views, 2, 'a2-p02-r2c3', '割り込みを使う');
    await passUntil(table, views, state => state.activeWindow?.kind === (scenario === 'property-arnes' ? 'effect-level' : 'attack-abilities'), 500);
    await expect(table.pages[0]!.getByRole('button', { name: `${name}を使う`, exact: true })).toHaveCount(0);
    await normal(table, views);
    expect(game(table, views).currentAttack!.technique).toMatchObject({ effectLevel: 5, damage: scenario === 'property-arnes' ? 10 : 7 });
    if (scenario === 'property-arnes') {
      const evade = game(table, views, 1).self.hand.find(id => getAction(id)?.name === '見切る')!;
      await card(table, views, 1, evade, '防御する');
    } else {
      await expect(table.pages[1]!.getByRole('region', { name: '間合いの状況' })).toContainText('必要2枚');
      for (const id of maais(table, views, 1).slice(0, 2)) await card(table, views, 1, id, '間合いを使う');
      expect(game(table, views).activeWindow?.kind).toBe('defense-advance'); await click(table, views, 0, 'パス');
    }
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(0); expect(done.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1);
  } finally { await table.close(); }
});

test('a single advance affects each actual spear target and restored progress keeps their payments separate', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'property-lancaster-shared');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id; const c = table.sessions[2]!.id;
    await click(table, views, 0, '瞬風を使う'); await normal(table, views);
    const beforeDistances = game(table, views).distances; const bCards = maais(table, views, 1); const cCards = maais(table, views, 2);
    for (const [seat, ids] of [[1, bCards], [2, cCards]] as const) for (const id of ids.slice(0, 2)) await card(table, views, seat, id, '間合いを使う');
    const advance = game(table, views).self.hand.find(id => getAction(id)?.name === '踏み込み／殴る')!;
    await card(table, views, 0, advance, '踏み込みを使う'); await table.pages[0]!.reload();
    const panel = table.pages[0]!.getByRole('region', { name: '間合いの状況' });
    await expect(panel).toContainText('今回の踏み込み1枚');
    await expect(panel.getByRole('listitem').filter({ hasText: '楓さん・1発目' })).toContainText('必要2枚・有効1枚・あと1枚');
    await expect(panel.getByRole('listitem').filter({ hasText: '凛さん・1発目' })).toContainText('必要2枚・有効1枚・あと1枚');
    await click(table, views, 0, 'パス'); await table.pages[1]!.reload();
    await expect(table.pages[1]!.getByRole('region', { name: '間合いの状況' })).toContainText('前の応酬から有効な間合い1枚');
    await card(table, views, 1, bCards[2]!, '間合いを使う'); await card(table, views, 2, cCards[2]!, '間合いを使う'); await click(table, views, 0, 'パス');
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(0); expect(done.players[c]!.damage).toBe(0); expect(done.distances).toEqual(beforeDistances);
    for (const id of [...bCards, ...cCards, advance]) expect(done.discard.filter(card => card === id)).toHaveLength(1);
    expect(done.maaiDefense).toBeNull(); await expect(panel).toHaveCount(0);
  } finally { await table.close(); }
});
