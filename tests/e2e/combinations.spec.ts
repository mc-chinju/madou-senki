import { expect, test } from '@playwright/test';
import { currentCardAction, observe, passUntil, tableFixture } from './helpers.js';

test('Beast King explicitly combines two physical cards and displays the accepted pair after reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-ready');
  try {
    const views = await observe(table); const page = table.pages[0]!; const owner = table.sessions[0]!.id;
    const hand = views.get(owner)!.game!.self.hand;
    await page.getByRole('region', { name: '自分の手札' }).getByRole('button', { name: '獣王剣', exact: true }).click();
    await page.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
    const choice = views.get(owner)!.game!.combinationOptions.find(option => option.cardInstanceId === 'a2-p09-r1c1')!.coSources.find(source => !source.dedicated && source.cardInstanceId === 'a2-p24-r1c2')!;
    await page.getByLabel('組み合わせる技').selectOption(`${choice.cardInstanceId}:false:`);
    await page.getByRole('article').filter({ has: page.getByRole('heading', { name: '楓', exact: true }) }).getByRole('checkbox').check();
    await page.getByRole('button', { name: '攻撃を確認して実行', exact: true }).click();
    await expect.poll(() => currentCardAction(views.get(owner)?.game)?.coSourceCardInstanceId).toBe(choice.cardInstanceId);
    expect(views.get(owner)!.game!.self.hand).toEqual(hand.filter(id => !['a2-p09-r1c1', choice.cardInstanceId].includes(id)));
    await page.reload();
    await expect(page.getByRole('region', { name: '現在の行動' })).toContainText('組み合わせた技');
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(14);
  } finally { await table.close(); }
});

test('Fate cancels the whole composite declaration while keeping both paid cards spent', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-cancel');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id;
    const action = currentCardAction(views.get(owner)!.game)!;
    await table.pages[1]!.reload();
    await table.pages[1]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await table.pages[1]!.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(table.sessions[1]!.id)?.game?.self.hand.includes('a2-p02-r2c3')).toBe(false);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.discard).toContain(action.cardInstanceId); expect(done.discard).toContain(action.coSourceCardInstanceId);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(0);
  } finally { await table.close(); }
});

test('Void Sword consumes the selected advance with its source and raises effect level without moving distance', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-advances');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const page = table.pages[0]!;
    const before = views.get(owner)!.game!;
    await page.getByRole('region', { name: '自分の手札' }).getByRole('button', { name: '魔空剣', exact: true }).click();
    await page.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
    await page.getByRole('group', { name: '消費する踏み込み' }).getByRole('checkbox', { name: '踏み込み／殴る', exact: true }).check();
    await page.getByRole('article').filter({ has: page.getByRole('heading', { name: '楓', exact: true }) }).getByRole('checkbox').check();
    await page.getByRole('button', { name: '攻撃を確認して実行', exact: true }).click();
    await expect.poll(() => currentCardAction(views.get(owner)?.game)?.cardInstanceId).toBe('a2-p09-r2c1');
    expect(views.get(owner)!.game!.self.hand).toEqual(before.self.hand.filter(id => !['a2-p09-r2c1', 'a2-p23-r1c2'].includes(id)));
    const defense = await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense');
    expect(defense.currentAttack!.technique.effectLevel).toBe(8);
    expect(defense.distanceMarkers).toEqual(before.distanceMarkers);
    expect(defense.distances).toEqual(before.distances);
  } finally { await table.close(); }
});

test('Black Wing post-hit payment is explicit and survives reload at its saved choice', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-hit-advance');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const page = table.pages[0]!;
    await page.reload();
    const panel = page.getByRole('region', { name: '技の追加効果' });
    await expect(panel.getByRole('button', { name: '踏み込みを消費して追加する', exact: true })).toBeDisabled();
    await panel.getByRole('checkbox', { name: '踏み込み／殴る', exact: true }).check();
    await panel.getByRole('button', { name: '踏み込みを消費して追加する', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.self.hand.includes('a2-p23-r1c2')).toBe(false);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(20);
    expect(done.discard.filter(id => id === 'a2-p23-r1c2')).toHaveLength(1);
  } finally { await table.close(); }
});

test('Black Wing can decline its saved post-hit payment after reload without consuming an advance', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-hit-advance');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const target = table.sessions[1]!.id; const page = table.pages[0]!;
    expect(views.get(owner)!.game!.self.hand).toContain('a2-p23-r1c2');
    await page.reload();
    const beforeRevision = views.get(owner)!.revision;
    await page.getByRole('region', { name: '技の追加効果' }).getByRole('button', { name: '追加しない', exact: true }).click();
    await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(beforeRevision);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[target]!.damage).toBe(15);
    expect(views.get(owner)!.game!.self.hand).toContain('a2-p23-r1c2');
    expect(done.discard).not.toContain('a2-p23-r1c2');
  } finally { await table.close(); }
});

test('Black Dragon optional saved check controls doubling without silently rolling', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-double');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id;
    await table.pages[0]!.getByRole('button', { name: 'ダメージ倍の判定を行う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.currentRoll?.purpose).toBe('technique-check');
    const rolling = await passUntil(table, views, game => game.currentRoll?.purpose === 'technique-check' && game.currentRoll.stage === 'after-roll');
    const success = rolling.currentRoll!.success;
    expect(typeof success).toBe('boolean');
    await table.pages[0]!.reload();
    await expect(table.pages[0]!.getByRole('region', { name: 'サイコロの結果' })).toContainText('技の追加判定');
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(success ? 20 : 10);
  } finally { await table.close(); }
});

test('Black Dragon can decline its saved check after reload without adding a technique roll', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-double');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const target = table.sessions[1]!.id; const page = table.pages[0]!;
    const rollCount = views.get(owner)!.game!.recentRolls.filter(roll => roll.purpose === 'technique-check').length;
    await page.reload();
    const beforeRevision = views.get(owner)!.revision;
    await page.getByRole('region', { name: '技の追加効果' }).getByRole('button', { name: '判定しない', exact: true }).click();
    await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(beforeRevision);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[target]!.damage).toBe(10);
    expect(done.recentRolls.filter(roll => roll.purpose === 'technique-check')).toHaveLength(rollCount);
  } finally { await table.close(); }
});

test('Back Heaven offers the second actual critical attempt after restoring the first result', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-critical');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id;
    expect(views.get(owner)!.game!.recentRolls.filter(roll => roll.purpose === 'ability-value')).toHaveLength(1);
    await table.pages[0]!.reload();
    await table.pages[0]!.getByRole('button', { name: '必殺を使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.currentAction?.source).toBe('ability');
    const rolled = await passUntil(table, views, game => game.currentRoll?.purpose === 'ability-value' && game.currentRoll.stage === 'after-roll');
    const faces = rolled.currentRoll!.faces;
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.recentRolls.filter(roll => roll.purpose === 'ability-value')).toHaveLength(2);
    expect(done.abilityOptions).toEqual([]);
    const target = done.players[table.sessions[1]!.id]!;
    if (faces[0] === faces[1]) expect(target.presence).toBe('dead');
    else expect(target.damage).toBe(Math.abs(faces[0]! - faces[1]!) === 1 ? 10 : 5);
  } finally { await table.close(); }
});

test('printed Shadow grants one real non-counter attack at the saved original attacker', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-shadow');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const defender = table.sessions[1]!.id; const page = table.pages[1]!;
    const defense = page.getByRole('complementary', { name: '現在の判断' });
    await defense.getByLabel('専用技として使う').check();
    await defense.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p08-r3c2');
    await defense.getByRole('button', { name: '防御する', exact: true }).click();
    await expect.poll(() => views.get(defender)?.game?.self.hand.includes('a2-p08-r3c2')).toBe(false);
    await passUntil(table, views, game => game.activeWindow?.kind === 'ability-attack');
    expect(views.get(defender)!.game!.additionalAttack).toEqual({ source: 'card', actorId: defender, targetId: owner, sourceCardInstanceId: 'a2-p08-r3c2' });
    expect(views.get(defender)!.game!.additionalAttackOptions.some(option => option.cardInstanceId === 'a2-p08-r3c1')).toBe(false);
    expect(views.get(defender)!.game!.additionalAttackOptions).toContainEqual({ cardInstanceId: 'a2-p08-r1c1', dedicated: false });
    await page.reload();
    const grant = page.getByRole('complementary', { name: '影分身による追加攻撃' });
    await expect(grant.getByRole('heading', { name: '影分身による追加攻撃を選ぶ', exact: true })).toBeVisible();
    await expect(grant.getByLabel('追加攻撃に使うカード').locator('option[value="a2-p08-r3c1"]')).toHaveCount(0);
    await expect(grant.getByLabel('追加攻撃に使うカード').locator('option[value="a2-p08-r1c1"]')).toHaveText('黒翼飛翔剣');
    await grant.getByLabel('追加攻撃に使うカード').selectOption('a2-p08-r1c1');
    await grant.getByRole('button', { name: '追加攻撃を行う', exact: true }).click();
    await expect.poll(() => views.get(defender)?.game?.self.hand.includes('a2-p08-r1c1')).toBe(false);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[defender]!.damage).toBe(0); expect(done.players[owner]!.damage).toBe(7);
    expect(done.phase).toBe('withdrawal'); expect(done.turnSeat).toBe(0);
  } finally { await table.close(); }
});

test('Lia intercepts the complete offered group and rolls her own whole two-die damage', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-lia');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const defender = table.sessions[2]!.id;
    const panel = table.pages[2]!.getByRole('region', { name: '技の追加効果' });
    await expect(panel).toContainText('楓・蓮');
    await table.pages[2]!.reload();
    await panel.getByRole('button', { name: '光王陣でまとめて防ぐ', exact: true }).click();
    await expect.poll(() => views.get(defender)?.game?.self.hand.includes('a2-p16-r3c3')).toBe(false);
    const rolled = await passUntil(table, views, game => game.currentRoll?.formula === 'd6-product-min10' && game.currentRoll.stage === 'after-roll');
    const [first, second] = rolled.currentRoll!.faces;
    expect(rolled.currentRoll!.total).toBe(Math.max(10, first! * second!));
    await expect(table.pages[2]!.getByRole('region', { name: 'サイコロの結果' })).toContainText('×');
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(0); expect(done.players[table.sessions[3]!.id]!.damage).toBe(0);
    expect(done.players[owner]!.damage).toBe(Math.max(10, first! * second!));
  } finally { await table.close(); }
});

test('Dragon Blast saves the shared distance roll and shows the target next-turn loss after reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-blast');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const target = table.sessions[1]!.id;
    const initial = views.get(owner)!.game!;
    const range = initial.recentRolls.find(roll => roll.purpose === 'technique-value');
    expect(range?.faces).toHaveLength(1);
    const rolled = await passUntil(table, views, game => game.currentRoll?.purpose === 'hit-resistance' && game.currentRoll.stage === 'after-roll');
    // Resistances are visible to the roller even while an observer's threshold remains private.
    const targetRoll = views.get(target)!.game!.currentRoll!;
    expect(targetRoll.threshold).toBe(6);
    expect(rolled.currentRoll!.faces).toHaveLength(2);
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[target]!.damage).toBe(targetRoll.success ? 10 : 30);
    expect(done.players[target]!.skipsNextTurn).toBe(true);
    await table.pages[1]!.reload();
    await expect(table.pages[1]!.getByRole('region', { name: '楓の状態異常' })).toContainText('次の手番を飛ばします');
    expect(views.get(target)!.game!.players[target]!.skipsNextTurn).toBe(true);
  } finally { await table.close(); }
});

test('Beast King can explicitly inherit a counter source in the normal defense window', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'combination-defense');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const defender = table.sessions[1]!.id;
    const panel = table.pages[1]!.getByRole('region', { name: '技の追加効果' });
    await expect(panel.getByRole('button', { name: '獣王剣の組み合わせで防御する', exact: true })).toBeDisabled();
    await panel.getByLabel('組み合わせる技').selectOption('a2-p08-r2c3:false:');
    await panel.getByRole('button', { name: '獣王剣の組み合わせで防御する', exact: true }).click();
    await expect.poll(() => currentCardAction(views.get(defender)?.game)?.coSourceCardInstanceId).toBe('a2-p08-r2c3');
    await table.pages[1]!.reload();
    await expect(table.pages[1]!.getByRole('region', { name: '現在の行動' })).toContainText('手裏剣');
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[defender]!.damage).toBe(0); expect(done.players[owner]!.damage).toBe(15);
    expect(done.discard).toContain('a2-p09-r1c1'); expect(done.discard).toContain('a2-p08-r2c3');
  } finally { await table.close(); }
});
