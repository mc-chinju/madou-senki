import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

test('Ida explicitly pays for healing and concealment after a cancellable declaration', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'ability-hide');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id;
    const hand = views.get(owner)!.game!.self.hand;
    const panel = table.pages[0]!.getByRole('region', { name: '使える特殊能力' });
    await expect(panel.getByRole('button', { name: '隠行を使う', exact: true })).toBeDisabled();
    await panel.getByLabel('消費する間合い').selectOption('a2-p07-r3c1');
    await panel.getByLabel('正体を裏に戻す').check();
    await panel.getByRole('button', { name: '隠行を使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.activeWindow?.kind).toBe('reclaim');
    const decision=views.get(owner)!.game!.reclaim!.decisionId;
    await table.pages[0]!.reload();
    await expect(table.pages[0]!.getByRole('button', {name:'回収せずに進む',exact:true})).toBeVisible();
    expect(views.get(owner)!.game!.reclaim!.decisionId).toBe(decision);
    expect(views.get(owner)!.game!.self.damage).toBe(5);
    await passUntil(table,views,game=>game.activeWindow?.kind==='declaration');
    expect(views.get(owner)!.game!.self.damage).toBe(5);
    expect(views.get(owner)!.game!.currentAction?.source).toBe('ability');
    await passUntil(table, views, game => !game.activeWindow);
    expect(views.get(owner)!.game!.self.damage).toBe(3);
    expect(views.get(owner)!.game!.self.hand).toEqual(hand.filter(id => id !== 'a2-p07-r3c1'));
    const other = views.get(table.sessions[1]!.id)!.game!.players[owner]!;
    expect(other.revealed).toBe(false); expect(other.characterId).toBeUndefined();
    expect(views.get(owner)!.game!.phase).toBe('hand-adjustment');
  } finally { await table.close(); }
});

test('a concealed ability remains private after reload and Fate cancels it without refunding its cost', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'ability-hidden-cancel');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const responder = table.sessions[1]!.id;
    expect(JSON.stringify(views.get(responder)!.game)).not.toContain('c2-p04-r2c2');
    await expect(table.pages[1]!.getByRole('region', { name: '現在の行動' })).toContainText('特殊能力');
    await table.pages[1]!.reload();
    await expect(table.pages[1]!.getByLabel('割り込み効果').locator('option[value="cancel-ability"]')).toHaveText('命運凶変: 能力の使用を取り消し');
    expect(views.get(responder)!.game!.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
    await table.pages[1]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await table.pages[1]!.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(responder)?.game?.self.hand.includes('a2-p02-r2c3')).toBe(false);
    await passUntil(table, views, game => !game.activeWindow);
    expect(views.get(owner)!.game!.self.damage).toBe(5);
    expect((await storedDiscard())).toContain('a2-p07-r3c1');
    expect(views.get(owner)!.game!.abilityOptions).toEqual([]);
    expect(views.get(responder)!.game!.players[owner]!.revealed).toBe(false);
  } finally { await table.close(); }
});

test('Ida may choose martial follower bypass while keeping the ignored follower in place', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'ability-martial');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const target = table.sessions[1]!.id;
    const followers = views.get(owner)!.game!.players[target]!.followers;
    await table.pages[0]!.getByRole('button', { name: '忍びを使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.currentAction?.source).toBe('ability');
    await passUntil(table, views, game => !game.activeWindow);
    expect(views.get(owner)!.game!.players[target]!.damage).toBe(1);
    expect(views.get(owner)!.game!.players[target]!.followers).toEqual(followers);
  } finally { await table.close(); }
});

test('Ida explicitly chooses a critical roll and its actual faces determine the hit outcome', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'ability-critical');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const target = table.sessions[1]!.id;
    await table.pages[0]!.getByRole('button', { name: '必殺を使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.currentAction?.source).toBe('ability');
    const rolled = await passUntil(table, views, game => game.currentRoll?.purpose === 'ability-value' && game.currentRoll.stage === 'after-roll');
    const faces = rolled.currentRoll!.faces; expect(faces).toHaveLength(2);
    expect(rolled.currentRoll!.kind).toBe('numeric');
    await table.pages[0]!.reload();
    await expect(table.pages[0]!.getByRole('region', { name: 'サイコロの結果' })).toContainText('特殊能力のサイコロ');
    expect(views.get(owner)!.game!.currentRoll!.faces).toEqual(faces);
    const done = await passUntil(table, views, game => !game.activeWindow);
    if (faces[0] === faces[1]) expect(done.players[target]!.presence).toBe('dead');
    else expect(done.players[target]!.damage).toBe(Math.abs(faces[0]! - faces[1]!) === 1 ? 8 : 4);
  } finally { await table.close(); }
});

test('critical dice reroll as a whole and never offer check-only forced failure', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'ability-critical-roll');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id;
    const original = views.get(owner)!.game!.currentRoll!;
    expect(original.faces).toEqual([2, 3]); expect(original.kind).toBe('numeric');
    const choices = table.pages[0]!.getByLabel('割り込み効果');
    await expect(choices.locator('option[value="force-fail"]')).toHaveCount(0);
    await choices.selectOption('reroll');
    await table.pages[0]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r1c3');
    await table.pages[0]!.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.self.hand.includes('a2-p02-r1c3')).toBe(false);
    const after = await passUntil(table, views, game => game.currentRoll?.rollId === original.rollId && game.currentRoll.generation === 1 && game.currentRoll.stage === 'after-roll');
    expect(after.currentRoll!.faces).toHaveLength(2); expect(after.currentRoll!.attempts[0]!.faces).toEqual([2, 3]);
  } finally { await table.close(); }
});

test('Shadow checks grant one optional physical attack against its source and then resume the original turn', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'ability-shadow');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const defender = table.sessions[1]!.id;
    await table.pages[1]!.getByRole('button', { name: '影分身を使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.currentAction?.source).toBe('ability');
    await passUntil(table, views, game => game.activeWindow?.kind === 'ability-attack');
    await table.pages[1]!.reload();
    const panel = table.pages[1]!.getByRole('complementary', { name: '能力による追加攻撃' });
    await expect(panel).toContainText('葵');
    await expect(panel.getByRole('button', { name: '追加攻撃をしない', exact: true })).toBeEnabled();
    await panel.getByLabel('追加攻撃に使うカード').selectOption({ label: '踏み込み／弓' });
    const hand = views.get(defender)!.game!.self.hand;
    await panel.getByRole('button', { name: '追加攻撃を行う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.currentAction?.source).toBe('card');
    const done = await passUntil(table, views, game => !game.activeWindow);
    expect(done.players[owner]!.damage).toBe(4); expect(done.players[defender]!.damage).toBe(0);
    expect(views.get(defender)!.game!.self.hand).toHaveLength(hand.length - 1);
    expect(done.turnSeat).toBe(0); expect(done.phase).toBe('withdrawal');
  } finally { await table.close(); }
});
