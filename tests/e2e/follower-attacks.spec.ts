import { expect, test } from '@playwright/test';
import { currentCardAction, observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

test('a placed Royal Guard attack leaves the defense column, survives reload and is spent', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-attack-royal');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[0]!;
    const panel = page.getByRole('region', { name: '従者による攻撃' });
    await expect(panel.getByRole('button', { name: '従者で攻撃する', exact: true })).toBeDisabled();
    await panel.getByRole('combobox', { name: '攻撃に使う従者', exact: true }).selectOption('a2-p21-r1c2');
    await expect(panel.getByLabel('専用の攻撃として使う')).not.toBeChecked();
    await panel.getByLabel('専用の攻撃として使う').check(); await panel.getByRole('radio', { name: '楓', exact: true }).check();
    await panel.getByRole('button', { name: '従者で攻撃する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.self.followers.length).toBe(0);
    expect(currentCardAction(views.get(a)?.game)?.sourceZone).toBe('followers');
    await page.reload(); await expect(page.getByRole('region', { name: '現在の行動' })).toContainText('配置中の従者を使用');
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[b]!.damage).toBe(5); expect((await storedDiscard())).toContain('a2-p21-r1c2');
    expect(views.get(a)!.game!.self.followers).toEqual([]);
  } finally { await table.close(); }
});

test('cancellation never puts a paid follower attack back into the column', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-attack-cancel');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[1]!;
    await page.reload(); await page.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    const revision = views.get(a)!.revision;
    await page.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[b]!.damage).toBe(0); expect((await storedDiscard())).toContain('a2-p21-r1c2');
    expect(views.get(a)!.game!.self.followers).toEqual([]); expect(views.get(a)!.game!.self.hand).not.toContain('a2-p21-r1c2');
  } finally { await table.close(); }
});

test('Griffin repeats its two shared hits against each selected target', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-attack-griffin');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const panel = table.pages[0]!.getByRole('region', { name: '従者による攻撃' });
    await panel.getByRole('combobox', { name: '攻撃に使う従者', exact: true }).selectOption('a2-p20-r3c1');
    await panel.getByLabel('専用の攻撃として使う').check();
    await panel.getByRole('checkbox', { name: '楓', exact: true }).check(); await panel.getByRole('checkbox', { name: '蓮', exact: true }).check();
    await expect(panel).toContainText('2回攻撃');
    await panel.getByRole('button', { name: '従者で攻撃する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.self.followers.length).toBe(0);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(16); expect(done.players[table.sessions[3]!.id]!.damage).toBe(16);
    expect(done.players[table.sessions[2]!.id]!.damage).toBe(0); expect((await storedDiscard())).toContain('a2-p20-r3c1');
  } finally { await table.close(); }
});

test('Fairies save separate effect and damage dice and share each result across selected targets', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-attack-fairy');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const page = table.pages[0]!; const panel = page.getByRole('region', { name: '従者による攻撃' });
    await panel.getByRole('combobox', { name: '攻撃に使う従者', exact: true }).selectOption('a2-p21-r3c3');
    await panel.getByLabel('専用の攻撃として使う').check();
    await panel.getByRole('checkbox', { name: '楓', exact: true }).check(); await panel.getByRole('checkbox', { name: '蓮', exact: true }).check();
    await panel.getByRole('button', { name: '従者で攻撃する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.self.hand.includes('a2-p21-r3c3')).toBe(false);
    const effect = await passUntil(table, views, game => game.currentRoll?.purpose === 'technique-value' && game.currentRoll.stage === 'after-roll');
    const effectFace = effect.currentRoll!.faces[0]!; const effectId = effect.currentRoll!.rollId;
    await page.reload(); await expect(page.getByRole('region', { name: 'サイコロの結果' })).toBeVisible();
    const damage = await passUntil(table, views, game => game.currentRoll?.purpose === 'attack-damage' && game.currentRoll.stage === 'after-roll');
    const damageFace = damage.currentRoll!.faces[0]!; expect(damage.currentRoll!.rollId).not.toBe(effectId);
    const defense = await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense');
    expect(currentCardAction(defense)?.technique.effectLevel).toBe(3 + effectFace);
    expect(currentCardAction(defense)?.technique.damage).toBe(4 + damageFace);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(4 + damageFace); expect(done.players[table.sessions[3]!.id]!.damage).toBe(4 + damageFace);
  } finally { await table.close(); }
});

test('Dwarves snapshot the current warrior level and resolve three hits at the same target', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-attack-dwarves');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const page = table.pages[0]!; const warrior = views.get(a)!.game!.self.stats.warrior_level;
    const panel = page.getByRole('region', { name: '従者による攻撃' });
    await panel.getByRole('combobox', { name: '攻撃に使う従者', exact: true }).selectOption('a2-p21-r2c3');
    await expect(panel).toContainText(`効果Lv ${warrior}`); await expect(panel).toContainText('3回攻撃');
    await panel.getByLabel('専用の攻撃として使う').check(); await panel.getByRole('radio', { name: '楓', exact: true }).check();
    await panel.getByRole('button', { name: '従者で攻撃する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.self.followers.length).toBe(0); await page.reload();
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(18); expect((await storedDiscard())).toContain('a2-p21-r2c3');
  } finally { await table.close(); }
});

test('Guardian fixes all legal recipients while excluding a revealed ally', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-attack-all');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const c = table.sessions[2]!.id; const d = table.sessions[3]!.id;
    const panel = table.pages[0]!.getByRole('region', { name: '従者による攻撃' });
    await panel.getByRole('combobox', { name: '攻撃に使う従者', exact: true }).selectOption('a2-p22-r3c3');
    await expect(panel).toContainText('対象を減らせません'); await expect(panel.getByRole('listitem')).toHaveText(['楓', '蓮']);
    await expect(panel.getByRole('checkbox')).toHaveCount(1); await panel.getByLabel('専用の攻撃として使う').check();
    await panel.getByRole('button', { name: '従者で攻撃する', exact: true }).click();
    await expect.poll(() => currentCardAction(views.get(a)?.game)?.targetIds).toEqual([b, d]);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[b]!.damage).toBe(10); expect(done.players[d]!.damage).toBe(10); expect(done.players[c]!.damage).toBe(0);
  } finally { await table.close(); }
});

test('Beast King combines a placed Griffin and spends both sources for each inherited hit', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-attack-beast');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const page = table.pages[0]!;
    await page.getByRole('region', { name: '自分の手札' }).getByRole('button', { name: '獣王剣', exact: true }).click();
    const confirmation = page.getByRole('region', { name: '操作の確認' }); await confirmation.getByLabel('専用技として使う').check();
    const component = confirmation.getByRole('combobox', { name: '組み合わせる技', exact: true }); await expect(component).toContainText('グリフォン（配置中）');
    await component.selectOption('a2-p20-r3c1:true:');
    const players = page.getByRole('region', { name: '参加者の公開状態' });
    for (const name of ['楓', '蓮']) await players.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('checkbox', { name: '対象に選ぶ' }).check();
    await page.getByRole('button', { name: '攻撃を確認して実行', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.self.followers.length).toBe(0);
    await page.reload(); await expect(page.getByRole('region', { name: '現在の行動' })).toContainText('組み合わせた従者も配置から外れ');
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(36); expect(done.players[table.sessions[3]!.id]!.damage).toBe(36);
    expect((await storedDiscard())).toContain('a2-p20-r3c1'); expect((await storedDiscard())).toContain('a2-p09-r1c1');
  } finally { await table.close(); }
});
