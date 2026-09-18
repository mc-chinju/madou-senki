import { expect, test } from '@playwright/test';
import { getAction, getCharacter } from '../../packages/catalog/src/index.js';
import { observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
function game(table: Table, views: Views, seat = 0) { return views.get(table.sessions[seat]!.id)!.game!; }
async function click(table: Table, views: Views, seat: number, name: string) {
  const owner = table.sessions[0]!.id; const revision = views.get(owner)!.revision;
  await table.pages[seat]!.getByRole('button', { name, exact: true }).click();
  await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
}
async function reload(table: Table, views: Views, seat = 0) {
  const before = structuredClone(game(table, views, seat));
  await table.pages[seat]!.reload();
  await expect(table.pages[seat]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
  expect(game(table, views, seat)).toEqual(before);
}
async function use(table: Table, views: Views, name: string, targetSeat?: number) {
  const page = table.pages[0]!;
  const panel = page.locator('.panel').filter({ has: page.getByRole('heading', { name, exact: true }) });
  if (targetSeat !== undefined) {
    await expect(panel.getByRole('button', { name: `${name}を使う`, exact: true })).toBeDisabled();
    await panel.getByRole('combobox', { name: '能力の対象', exact: true }).selectOption(table.sessions[targetSeat]!.id);
  }
  await click(table, views, 0, `${name}を使う`);
}
async function cancel(table: Table, views: Views) {
  await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[3]!.id, 500);
  const panel = table.pages[3]!.getByRole('complementary', { name: '現在の判断' });
  await panel.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption('cancel-ability');
  await panel.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
  await click(table, views, 3, '割り込みを使う');
}
const inspections = [
  { scenario: 'info-cham-followers', name: '見ちゃった', zone: 'followers' },
  { scenario: 'info-lia-chants', name: '神出鬼没', zone: 'chants' },
  { scenario: 'info-lester-rumor', name: '噂', zone: 'character' },
  { scenario: 'info-alseil-hand', name: '占星', zone: 'hand' },
] as const;
for (const entry of inspections.slice(0, 1)) test(`${entry.scenario} shows only the owner the exact original information and restores it on reload`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table); const targetId = table.sessions[1]!.id;
    const target = structuredClone(table.expected!.players[targetId]!);
    await use(table, views, entry.name, 1);
    await passUntil(table, views, state => state.activeWindow?.kind === 'private-inspection', 500);
    const decision = structuredClone(game(table, views).inspection!);
    expect(decision).toMatchObject({ targetId, zone: entry.zone });
    const panel = table.pages[0]!.getByRole('complementary', { name: '自分だけの確認内容' });
    await expect(panel).toContainText('あなただけに表示');
    if (entry.zone === 'character') {
      expect(decision.characterId).toBe(target.characterId);
      await expect(panel).toContainText(getCharacter(target.characterId)!.name);
    } else {
      const ids = entry.zone === 'hand' ? target.hand : target[entry.zone].map(card => card.cardInstanceId);
      expect(decision.cards.map(card => card.cardInstanceId)).toEqual(ids);
      for (const id of ids) await expect(panel).toContainText(getAction(id)!.name);
      for (const seat of [2, 3]) for (const id of ids) expect(JSON.stringify(game(table, views, seat))).not.toContain(id);
    }
    for (const seat of [1, 2, 3]) {
      expect(game(table, views, seat).inspection).toBeNull();
      await expect(table.pages[seat]!.getByRole('complementary', { name: '自分だけの確認内容' })).toHaveCount(0);
      await expect(table.pages[seat]!.getByRole('complementary', { name: '情報確認の判断' })).toContainText('確認を待っています');
    }
    await reload(table, views); expect(game(table, views).inspection).toEqual(decision);
    await click(table, views, 0, '確認を終える');
    await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views).inspection).toBeNull(); expect(game(table, views).phase).toBe('action');
    const stored = await (await request.get(`/__test/rooms/${table.roomId}/game`)).json();
    expect(stored.players[targetId]).toEqual(target);
  } finally { await table.close(); }
});