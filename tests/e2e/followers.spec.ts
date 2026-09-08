import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

for (const dedicated of [false, true]) test(`Royal Guard reflection preserves its placed source with explicit dedication ${dedicated}`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-royal');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[1]!;
    await page.reload();
    const option = page.getByLabel('王立騎士団の専用効果を使う'); await expect(option).not.toBeChecked();
    if (dedicated) await option.check();
    const before = views.get(a)!.revision;
    await page.getByRole('button', { name: '従者で受ける', exact: true }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(before);
    if (!dedicated) {
      await passUntil(table, views, game => game.currentRoll?.purpose === 'follower-morale' && game.currentRoll.stage === 'after-roll');
      await page.reload(); await expect(page.getByRole('region', { name: 'サイコロの結果' })).toBeVisible();
    }
    const reflected = await passUntil(table, views, game => game.currentAction?.source === 'follower');
    expect(reflected.activeWindow?.kind).toBe('normal-defense');
    await page.reload(); await expect(page.getByRole('region', { name: '現在の行動' })).toContainText('王立騎士団による反射');
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[a]!.damage).toBe(4); expect(done.players[b]!.damage).toBe(0);
    expect(views.get(b)!.game!.self.followers.map(card => card.cardInstanceId)).toEqual(['a2-p21-r1c2']);
    expect(done.discard).not.toContain('a2-p21-r1c2');
    expect(done.recentRolls.filter(roll => roll.purpose === 'follower-morale')).toHaveLength(dedicated ? 0 : 1);
  } finally { await table.close(); }
});

test('Skeleton revives at its saved position after absorbing an eligible hit', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-regeneration');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id;
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[b]!.damage).toBe(1);
    expect(views.get(b)!.game!.self.followers).toEqual([{ cardInstanceId: 'a2-p19-r2c1', revealed: true }]);
    expect(done.discard).not.toContain('a2-p19-r2c1');
    await table.pages[1]!.reload(); await expect(table.pages[1]!.getByRole('region', { name: '自分の従者' })).toContainText('スケルトン');
  } finally { await table.close(); }
});

test('rear guard reveals and cancels follower bypass before the front follower takes damage', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-rear-guard');
  try {
    const views = await observe(table); const b = table.sessions[1]!.id;
    const rolled = await passUntil(table, views, game => game.currentRoll?.purpose === 'follower-morale' && game.currentRoll.stage === 'after-roll');
    expect(rolled.players[b]!.followers[0]!.face).toBe('back'); expect(rolled.players[b]!.followers[1]!.face).toBe('front');
    await table.pages[1]!.reload();
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[b]!.damage).toBe(0);
    expect(views.get(b)!.game!.self.followers.map(card => card.cardInstanceId)).toEqual(['a2-p22-r1c3']);
  } finally { await table.close(); }
});

test('follower arrangement permits Dark Saint reordering and only eligible replacement', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-placement');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const page = table.pages[0]!;
    const panel = page.getByRole('region', { name: '従者の配置', exact: true });
    const saint = panel.getByRole('listitem').filter({ hasText: '闇の聖女' });
    await expect(saint.getByRole('button', { name: '外す', exact: true })).toBeDisabled();
    await saint.getByRole('button', { name: '後ろへ', exact: true }).click();
    await expect(panel.getByRole('listitem').last()).toContainText('闇の聖女');
    await panel.getByRole('listitem').filter({ hasText: 'ゴブリン' }).getByRole('button', { name: '外す', exact: true }).click();
    const select = panel.getByLabel('従者を加える'); await expect(select).not.toContainText('アルケミア城');
    await select.selectOption({ label: '砦' });
    await panel.getByRole('button', { name: 'この順番で確定', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.self.followers.map(card => card.cardInstanceId)).toEqual(['a2-p21-r2c1', 'a2-p19-r1c3']);
  } finally { await table.close(); }
});

for (const scenario of ['magic-gate-ready', 'magic-gate-hidden-invalid', 'magic-gate-extra-slot'] as const) test(`${scenario} acquires by public position with explicit costs and saved ordering`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, scenario);
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const c = table.sessions[2]!.id; const page = table.pages[0]!;
    const hidden = table.expected!.players[b]!.followers[0]!.cardInstanceId;
    const initial = views.get(a)!.game!;
    expect(initial.magicGateTargets.find(target => target.actorId === b)?.positions).toEqual([0, 1]);
    expect(JSON.stringify(initial)).not.toContain(hidden);
    const panel = page.getByRole('region', { name: '魔招門による従者の取得' });
    await expect(panel).toContainText('取得できなくても、使用した札は戻りません');
    await panel.getByRole('combobox', { name: '取得する従者', exact: true }).selectOption(`${b}:0`);
    const extra = scenario === 'magic-gate-extra-slot';
    if (extra) await expect(panel.getByLabel('受入れのために外す従者')).toHaveCount(0);
    else {
      const cost = panel.getByLabel('受入れのために外す従者'); await expect(cost).toHaveValue(''); await expect(cost).not.toContainText('闇の聖女');
      await cost.selectOption({ label: 'ゴブリン' });
    }
    await panel.getByLabel('取得した従者の配置先').selectOption(extra ? '2' : '0');
    const revision = views.get(a)!.revision;
    await panel.getByRole('button', { name: '魔招門を使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    expect(JSON.stringify(views.get(c)!.game)).not.toContain(hidden);
    await page.reload();
    const done = await passUntil(table, views, game => !game.activeWindow);
    const acquired = scenario !== 'magic-gate-hidden-invalid';
    const own = views.get(a)!.game!.self;
    expect(own.hand).not.toContain('a2-p17-r3c3');
    expect(own.followers.map(card => card.cardInstanceId)).toEqual(extra ? ['a2-p21-r2c1', 'a2-p18-r3c1', hidden] : acquired ? [hidden, 'a2-p21-r2c1'] : ['a2-p21-r2c1']);
    expect(views.get(b)!.game!.self.followers.some(card => card.cardInstanceId === hidden)).toBe(!acquired);
    expect(done.players[b]!.followers).toHaveLength(acquired ? 1 : 2);
    expect(JSON.stringify(views.get(c)!.game)).not.toContain(hidden);
    if (!acquired) expect(JSON.stringify(views.get(a)!.game)).not.toContain(hidden);
  } finally { await table.close(); }
});

test('canceling a declared Gate after reload keeps both paid cards spent and the hidden target in place', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'magic-gate-cancel');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[1]!;
    const original = table.expected!.players[b]!.followers;
    await page.reload();
    const panel = page.getByRole('complementary', { name: '現在の判断' });
    await panel.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    const revision = views.get(a)!.revision;
    await panel.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(views.get(b)!.game!.self.followers).toEqual(original);
    expect(views.get(a)!.game!.self.followers.map(card => card.cardInstanceId)).toEqual(['a2-p21-r2c1']);
    expect(views.get(a)!.game!.self.hand).not.toContain('a2-p17-r3c3');
    expect(views.get(a)!.game!.self.hand).not.toContain('a2-p18-r3c1');
    expect(JSON.stringify(done)).not.toContain(original[0]!.cardInstanceId);
  } finally { await table.close(); }
});

test('initial placement uses faction eligibility before sending a chosen follower', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-initial');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const page = table.pages[0]!;
    const hand = page.getByRole('region', { name: '自分の手札' });
    await hand.getByRole('button', { name: 'アルケミア城', exact: true }).click();
    await expect(page.getByRole('button', { name: '従者を置く', exact: true })).toBeDisabled();
    await hand.getByRole('button', { name: 'アルケミア城', exact: true }).click();
    await hand.getByRole('button', { name: '砦', exact: true }).click();
    await page.getByRole('button', { name: '従者を置く', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.self.followers.map(card => card.cardInstanceId)).toEqual(['a2-p19-r1c3']);
    expect(views.get(a)!.game!.self.hand).toContain('a2-p20-r3c2');
  } finally { await table.close(); }
});
