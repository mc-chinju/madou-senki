import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
function game(table: Table, views: Views, seat = 0) { return views.get(table.sessions[seat]!.id)!.game!; }
async function click(table: Table, views: Views, seat: number, label: string) {
  const owner = table.sessions[0]!.id; const revision = views.get(owner)!.revision;
  await table.pages[seat]!.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
}
function incoming(table: Table, seat = 1) { return table.pages[seat]!.getByRole('region', { name: '各対象が受ける技' }); }
function originalAttackCard(table: Table, views: Views) {
  const action = game(table, views).currentAction;
  expect(action).toMatchObject({ source: 'card', sourceZone: 'hand', actorId: table.sessions[0]!.id });
  if (!action || action.source === 'ability') throw Error('ORIGINAL_ATTACK_CARD_MISSING');
  return action.cardInstanceId;
}
function expectConsumedAttack(done: ReturnType<typeof game>, cardInstanceId: string) {
  expect(done.discard.filter(id => id === cardInstanceId)).toHaveLength(1);
  expect(done.self.hand).not.toContain(cardInstanceId);
  expect(done.self.chants.map(card => card.cardInstanceId)).not.toContain(cardInstanceId);
  expect(done.self.followers.map(card => card.cardInstanceId)).not.toContain(cardInstanceId);
}

for (const robeFirst of [true, false]) test(`Fury robeFirst=${robeFirst} restores the first choice and lets the second complete immunity`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'received-fury');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id; const attackCard = originalAttackCard(table, views);
    await expect(incoming(table)).toContainText('効果Lv 4 / ダメージ 4');
    const first = robeFirst ? 'ミスリルのローブ' : '光の結界'; const second = robeFirst ? '光の結界' : 'ミスリルのローブ';
    await click(table, views, 1, `${first}を使う`);
    for (const seat of [0, 2, 3]) expect(JSON.stringify(game(table, views, seat))).not.toContain(first);
    await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500);
    await table.pages[1]!.reload();
    await expect(incoming(table)).toContainText(`効果Lv ${robeFirst ? 4 : 3} / ダメージ 4`);
    await expect(table.pages[1]!.getByRole('button', { name: `${first}を使う`, exact: true })).toHaveCount(0);
    await expect(table.pages[1]!.getByRole('button', { name: `${second}を使う`, exact: true })).toBeEnabled();
    await click(table, views, 1, `${second}を使う`);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(0); expect(attackCard).toBe('a2-p12-r2c2'); expectConsumedAttack(done, attackCard);
    await expect(incoming(table)).toHaveCount(0);
  } finally { await table.close(); }
});
test('Fury may decline both abilities and take the original damage', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'received-fury');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id; const attackCard = originalAttackCard(table, views);
    await expect(table.pages[1]!.getByRole('button', { name: '光の結界を使う', exact: true })).toBeVisible();
    await expect(table.pages[1]!.getByRole('button', { name: 'ミスリルのローブを使う', exact: true })).toBeVisible();
    await expect(incoming(table)).toContainText('効果Lv 4 / ダメージ 4');
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(4); expectConsumedAttack(done, attackCard);
  } finally { await table.close(); }
});
test('a canceled reduction after reload cannot activate the reserved robe or be retried', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'received-fury');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id; const c = table.sessions[2]!.id; const attackCard = originalAttackCard(table, views);
    await click(table, views, 1, 'ミスリルのローブを使う'); await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500);
    await click(table, views, 1, '光の結界を使う');
    await passUntil(table, views, state => state.activeWindow?.pendingActorId === c && !!state.reactionTargetAbilityId, 500);
    await table.pages[2]!.reload(); await table.pages[2]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await click(table, views, 2, '割り込みを使う');
    await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500); await table.pages[1]!.reload();
    await expect(incoming(table)).toContainText('効果Lv 4 / ダメージ 4');
    await expect(table.pages[1]!.getByRole('button', { name: '光の結界を使う', exact: true })).toHaveCount(0);
    await expect(table.pages[1]!.getByRole('button', { name: 'ミスリルのローブを使う', exact: true })).toHaveCount(0);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[b]!.damage).toBe(4); expect(done.discard.filter(id => id === 'a2-p02-r2c3')).toHaveLength(1); expectConsumedAttack(done, attackCard);
  } finally { await table.close(); }
});
for (const black of [true, false]) test(`White Silver black=${black} selects reduction and immunity as one package`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, black ? 'received-silver-black' : 'received-silver-white');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id; const attackCard = originalAttackCard(table, views);
    await expect(incoming(table)).toContainText(`効果Lv 5 / ダメージ ${black ? 12 : 6}`);
    const choices = table.pages[1]!.getByRole('region', { name: '使える特殊能力' });
    await expect(choices).toContainText('その後、効果Lv4以下'); await expect(choices.getByRole('checkbox')).toHaveCount(0);
    await click(table, views, 1, '白銀の鎧を使う');
    if (!black) {
      await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500); await table.pages[1]!.reload();
      await expect(incoming(table)).toContainText('効果Lv 5 / ダメージ 6');
    }
    const done = await passUntil(table, views, state => !state.activeWindow, 500); expect(done.players[b]!.damage).toBe(black ? 0 : 6); expectConsumedAttack(done, attackCard);
  } finally { await table.close(); }
});
for (const hp of [false, true]) test(`Shelim hp=${hp} uses the incoming damage before a follower reduces it`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, hp ? 'received-shelim-hp' : 'received-shelim');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id; const attackCard = originalAttackCard(table, views);
    await expect(incoming(table)).toContainText(`効果Lv 6 / ダメージ ${hp ? 6 : 5}`);
    await expect(incoming(table)).toContainText('通常防御中のダメージは、従者のHPで軽減する前の値です');
    if (hp) { expect(game(table, views).discard).toContain('a2-p05-r2c3'); expect(game(table, views, 1).self.followers.map(card => card.cardInstanceId)).toEqual(['a2-p18-r3c3']); }
    await click(table, views, 1, '絶対結界を使う');
    if (hp) {
      await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500); await table.pages[1]!.reload();
      await expect(incoming(table)).toContainText('効果Lv 6 / ダメージ 6');
      await passUntil(table, views, state => state.followerDefenseResults.some(result => result.cardInstanceId === 'a2-p18-r3c3'), 500);
      expect(game(table, views).followerDefenseResults[0]!.hits[0]!.hpReduction).toBe(1);
    }
    const done = await passUntil(table, views, state => !state.activeWindow, 500); expect(done.players[b]!.damage).toBe(hp ? 5 : 0); expectConsumedAttack(done, attackCard);
  } finally { await table.close(); }
});
test('a shared attack displays each received value independently after reduction and reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'received-shared');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id; const c = table.sessions[2]!.id; const attackCard = originalAttackCard(table, views);
    await click(table, views, 1, '闇の結界を使う'); await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500);
    for(const page of table.pages)await page.reload();
    for(const session of table.sessions)expect(views.get(session.id)!.game!.currentAction).toMatchObject({technique:{effectLevel:6,damage:8}});
    await expect(incoming(table).getByRole('listitem').filter({ hasText: '楓さん・1発目' })).toContainText('効果Lv 5 / ダメージ 8');
    await expect(incoming(table).getByRole('listitem').filter({ hasText: '凛さん・1発目' })).toContainText('効果Lv 6 / ダメージ 8');
    await click(table, views, 1, 'パス'); expect(game(table, views).currentAttack!.targetId).toBe(c); expect(game(table, views).currentAttack!.technique.effectLevel).toBe(6);
    const done = await passUntil(table, views, state => !state.activeWindow, 500); expect(done.players[b]!.damage).toBe(8); expect(done.players[c]!.damage).toBe(8); expectConsumedAttack(done, attackCard);
    for(const [seat,page] of table.pages.entries()){await page.reload();const g=views.get(table.sessions[seat]!.id)!.game!;expect(g.players[b]!.damage).toBe(8);expect(g.players[c]!.damage).toBe(8);expectConsumedAttack(g,attackCard);}
  } finally { await table.close(); }
});
for (const entry of [
  { scenario: 'received-aiel-fire', ability: '氷の結界' },
  { scenario: 'received-fleiard-water', ability: '炎の結界' },
] as const) test(`${entry.ability} can block the other named element through the actual controls`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table); const b = table.sessions[1]!.id; const attackCard = originalAttackCard(table, views);
    await expect(table.pages[1]!.getByRole('region', { name: '使える特殊能力' })).toContainText('炎・水');
    await click(table, views, 1, `${entry.ability}を使う`);
    const done = await passUntil(table, views, state => !state.activeWindow, 500); expect(done.players[b]!.damage).toBe(0); expectConsumedAttack(done, attackCard);
  } finally { await table.close(); }
});
