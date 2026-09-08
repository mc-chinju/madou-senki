import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

test('Jill explicitly heals the near other player without healing herself', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lifetime-heal');
  try {
    const views = await observe(table); const [a, b] = table.sessions.map(s => s.id) as [string, string]; const page = table.pages[0]!;
    await page.getByLabel('手番技として使うカード').selectOption('a2-p14-r3c1');
    await page.getByLabel('専用効果を使う', { exact: true }).check();
    await page.getByLabel('回復させる近くの相手').selectOption(b);
    await page.getByRole('button', { name: '手番技を使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.activeWindow?.kind).toBe('declaration');
    await passUntil(table, views, game => !game.activeWindow);
    expect(views.get(a)!.game!.self.damage).toBe(3);
    expect(views.get(b)!.game!.self.damage).toBe(0);
    expect(views.get(a)!.game!.discard).toContain('a2-p14-r3c1');
  } finally { await table.close(); }
});

test('Uonos chooses revival and allegiance explicitly then resumes after re-setup', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lifetime-revive');
  try {
    const views = await observe(table); const [a, b] = table.sessions.map(s => s.id) as [string, string]; const page = table.pages[0]!;
    expect(views.get(a)!.game!.players[b]!.presence).toBe('dead');
    await page.getByLabel('手番技として使うカード').selectOption('a2-p13-r3c1');
    await page.getByLabel('専用効果を使う', { exact: true }).check();
    await page.getByRole('group', { name: '復活させる相手（複数選択可）' }).getByLabel('楓', { exact: true }).check();
    await page.getByLabel('楓の陣営・目的を自分と同じにする').check();
    await page.getByRole('button', { name: '手番技を使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.activeWindow?.kind).toBe('declaration');
    await passUntil(table, views, game => game.lifecycleDecision?.kind === 're-setup');
    await table.pages[1]!.reload();
    await table.pages[1]!.getByRole('button', { name: '従者の配置を終える', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.activeWindow).toBeNull();
    expect(views.get(b)!.game!.self.faction).toBe('EVIL');
    expect(views.get(b)!.game!.self.hand).toHaveLength(5);
    expect(views.get(a)!.game!.phase).toBe('hand-adjustment');
  } finally { await table.close(); }
});

test('Soul drain keeps its explicit choice after reload and can choose stat loss instead of death', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lifetime-soul');
  try {
    const views = await observe(table); const [a, b] = table.sessions.map(s => s.id) as [string, string];
    const before = views.get(b)!.game!.self.stats;
    expect(views.get(b)!.game!.lifetimeDecision).toBeNull();
    await table.pages[0]!.reload();
    await expect(table.pages[0]!.getByRole('button', { name: '即死させる', exact: true })).toBeEnabled();
    await expect(table.pages[0]!.getByRole('button', { name: 'CHOOSE_LIFETIME_EFFECT', exact: true })).toHaveCount(0);
    await table.pages[0]!.getByRole('button', { name: '能力値を各1下げる', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.lifetimeDecision).toBeNull();
    await passUntil(table, views, game => !game.activeWindow);
    expect(views.get(b)!.game!.self.stats).toMatchObject({ warrior_level: before.warrior_level - 1, magic_level: before.magic_level - 1, spirit: before.spirit - 1 });
    await expect(table.pages[1]!.getByRole('region', { name: '楓の状態異常' }).first()).toContainText('死亡するまで');
    expect(views.get(a)!.game!.players[b]!.presence).toBe('active');
  } finally { await table.close(); }
});

test('fixed stop shows the saved dice result as personal turns after reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lifetime-fixed-stop');
  try {
    const views = await observe(table); const [a, b] = table.sessions.map(s => s.id) as [string, string];
    await table.pages[0]!.getByRole('button', { name: '期間付きの停止を与える', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.lifetimeDecision).toBeNull();
    await passUntil(table, views, game => game.currentRoll?.purpose === 'stop-duration' && game.currentRoll.stage === 'after-roll');
    const turns = views.get(a)!.game!.currentRoll!.total!;
    expect(turns).toBeGreaterThanOrEqual(1); expect(turns).toBeLessThanOrEqual(6);
    await passUntil(table, views, game => !game.activeWindow);
    await table.pages[1]!.reload();
    const status = table.pages[1]!.getByRole('region', { name: '楓の状態異常' }).first();
    await expect(status).toContainText(`あと自分の手番${turns}回`);
    await expect(status).not.toContainText('次の回復判定');
    expect(views.get(b)!.game!.players[b]!.statuses).toContainEqual(expect.objectContaining({ timing: 'fixed-turns', remainingTurns: turns }));
  } finally { await table.close(); }
});

test('deadly stop explains its next actual recovery deadline', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lifetime-deadly-stop');
  try {
    await observe(table);
    await expect(table.pages[1]!.getByRole('region', { name: '楓の状態異常' }).first()).toContainText('次の回復判定に失敗すると死亡');
    await expect(table.pages[1]!.getByRole('region', { name: '楓の状態異常' }).first()).toContainText('精神力−3');
  } finally { await table.close(); }
});

test('actual otherworld banishment returns on Dawn without clearing unrelated status or possessions', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lifetime-otherworld');
  try {
    const views = await observe(table); const [a, b] = table.sessions.map(s => s.id) as [string, string];
    const before = views.get(b)!.game!;
    expect(before.players[b]!.presence).toBe('otherworld');
    await table.pages[2]!.getByRole('button', { name: 'カードを引く', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.players[b]?.presence).toBe('active');
    expect(views.get(b)!.game!.self.hand).toEqual(before.self.hand);
    expect(views.get(b)!.game!.self.followers).toEqual(before.self.followers);
    expect(views.get(b)!.game!.players[b]!.statuses).toEqual(before.players[b]!.statuses);
    await expect(table.pages[1]!.getByRole('region', { name: '楓の状態異常' }).first()).toContainText('特殊能力無効');
  } finally { await table.close(); }
});

test('Mekai explains its defense restriction and offers teleport without a fixed barrier', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lifetime-mekai-defense');
  try {
    await observe(table); const page = table.pages[1]!;
    await expect(page.getByRole('complementary', { name: '現在の判断' })).toContainText('転移・反撃・特殊能力で防御');
    const cards = page.getByRole('combobox', { name: '使うカード', exact: true });
    await expect(cards.locator('option[value="a2-p18-r2c2"]')).toHaveCount(0);
    await expect(cards.locator('option[value="a2-p06-r1c1"]')).toHaveCount(1);
    await cards.selectOption('a2-p06-r1c1');
    await expect(page.getByRole('button', { name: '防御する', exact: true })).toBeEnabled();
  } finally { await table.close(); }
});
