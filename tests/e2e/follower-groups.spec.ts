import { allCardInstanceIds, type GameState } from '../../packages/engine/src/index.js';
import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';
import { currentCardAction, observe, passUntil, tableFixture, windowPassButtonName } from './helpers.js';

async function addSource(panel: Locator, id: string) {
  await panel.getByRole('combobox', { name: '追加する従者', exact: true }).selectOption(id);
  await panel.getByRole('button', { name: '攻撃に加える', exact: true }).click();
}
async function storedGame(request: APIRequestContext, roomId: string): Promise<GameState> {
  const response = await request.get(`/__test/rooms/${roomId}/game`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<GameState>;
}
async function selectUpa(panel: Locator, dragon = 'a2-p22-r2c2') {
  await panel.getByRole('combobox', { name: '使う能力', exact: true }).selectOption('c2-p05-r1c2-ab02');
  await addSource(panel, 'a2-p20-r3c1');
  const griffin = panel.getByRole('group', { name: 'グリフォン（配置中）', exact: true });
  await expect(griffin.getByLabel('専用効果を使う')).not.toBeChecked();
  await griffin.getByLabel('専用効果を使う').check();
  await griffin.getByRole('checkbox', { name: '楓', exact: true }).check();
  await griffin.getByRole('checkbox', { name: '蓮', exact: true }).check();
  await addSource(panel, dragon);
}

test('Upa explicitly orders two sources with separate targets and retains one follower snapshot after reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-group-upa');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const d = table.sessions[3]!.id; const page = table.pages[0]!;
    const panel = page.getByRole('region', { name: '複数従者の攻撃' });
    await expect(panel.getByRole('button', { name: '選んだ従者で攻撃する', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'USE_FOLLOWER_ATTACK', exact: true })).toHaveCount(0);
    await selectUpa(panel);
    const fireRow = panel.getByRole('listitem').filter({ has: page.getByRole('group', { name: '炎竜（手札）', exact: true }) });
    await fireRow.getByRole('button', { name: '前へ', exact: true }).click();
    await panel.getByRole('button', { name: '選んだ従者で攻撃する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.followerBundle?.sources.map(source => source.cardInstanceId)).toEqual(['a2-p22-r2c2', 'a2-p20-r3c1']);
    expect(views.get(a)!.game!.self.followers).toEqual([]);
    await page.reload(); await expect(page.getByRole('region', { name: '同時に使っている従者' })).toContainText('炎竜');
    const defense = await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense', 400);
    expect(currentCardAction(defense)?.cardInstanceId).toBe('a2-p22-r2c2'); expect(defense.currentAttack?.technique.damage).toBe(12);
    const done = await passUntil(table, views, game => !game.activeWindow, 400);
    expect(done.players[b]!.damage).toBe(6); expect(done.players[d]!.damage).toBe(28);
    expect(done.discard).toEqual(expect.arrayContaining(['a2-p20-r3c1', 'a2-p22-r2c2', 'a2-p21-r2c3']));
    expect(done.followerBundle).toBeNull();
  } finally { await table.close(); }
});

test('Dia keeps source focus, hit-specific defenses and one follower snapshot across heterogeneous hits', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-group-dia');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const d = table.sessions[3]!.id; const page = table.pages[0]!;
    const panel = page.getByRole('region', { name: '複数従者の攻撃' });
    await panel.getByRole('combobox', { name: '使う能力', exact: true }).selectOption('c2-p06-r1c2-ab04');
    await addSource(panel, 'a2-p21-r2c3'); await addSource(panel, 'a2-p21-r2c1');
    const dwarves = panel.getByRole('group', { name: '小人族（配置中）', exact: true }); const saint = panel.getByRole('group', { name: '闇の聖女（手札）', exact: true });
    await dwarves.getByRole('radio', { name: '楓', exact: true }).check();
    await saint.getByRole('radio', { name: '蓮', exact: true }).check();
    await expect(dwarves.getByRole('radio', { name: '楓', exact: true })).toBeChecked();
    await expect(dwarves).toContainText('3回攻撃'); await expect(saint).toContainText('1回攻撃');
    await panel.getByRole('button', { name: '選んだ従者で攻撃する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.followerBundle?.sources.length).toBe(2);
    const preparing = await passUntil(table, views, game => game.followerBundle?.stage === 'prepare' && game.followerBundle.currentSourceIndex === 0
      && currentCardAction(game)?.cardInstanceId === 'a2-p21-r2c3', 400);
    expect(preparing.followerBundle?.sources.map(source => source.cardInstanceId)).toEqual(['a2-p21-r2c3', 'a2-p21-r2c1']);
    await page.reload();
    const action = page.getByRole('region', { name: '現在の行動' });
    const summary = page.getByRole('region', { name: '同時に使っている従者' });
    await expect(action).toContainText('小人族');
    await expect(summary.locator('li[aria-current="step"]')).toContainText(/小人族.*現在の技/);

    for (let hitIndex = 0; hitIndex < 3; hitIndex++) {
      const defense = await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense'
        && game.currentAttack?.targetId === b && game.currentAttack.hitIndex === hitIndex, 400);
      expect(currentCardAction(defense)?.cardInstanceId).toBe('a2-p21-r2c3');
      expect(defense.followerBundle?.currentSourceIndex).toBe(0);
      expect(defense.currentAttack?.targets.find(target => target.actorId === b)?.hits[hitIndex]).toMatchObject({
        index: hitIndex, sourceCardInstanceId: 'a2-p21-r2c3', technique: { effectLevel: 4, damage: 6 },
      });
      if (hitIndex === 1) {
        await page.reload();
        await expect(action).toContainText('小人族');
        await expect(summary.locator('li[aria-current="step"]')).toContainText(/小人族.*現在の技/);
      }
      const revision = views.get(a)!.revision;
      await table.pages[1]!.getByRole('button', { name: windowPassButtonName }).click();
      await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    }

    const saintDefense = await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense'
      && game.currentAttack?.targetId === d && game.currentAttack.hitIndex === 3, 400);
    expect(currentCardAction(saintDefense)?.cardInstanceId).toBe('a2-p21-r2c1');
    expect(saintDefense.followerBundle?.currentSourceIndex).toBe(1);
    expect(saintDefense.currentAttack?.targets.find(target => target.actorId === d)?.hits[0]).toMatchObject({
      index: 3, sourceCardInstanceId: 'a2-p21-r2c1', technique: { effectLevel: 5, damage: 6 },
    });
    await page.reload();
    await expect(action).toContainText('闇の聖女');
    await expect(summary.locator('li[aria-current="step"]')).toContainText(/闇の聖女.*現在の技/);
    const saintRevision = views.get(a)!.revision;
    await table.pages[3]!.getByRole('button', { name: windowPassButtonName }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(saintRevision);

    const afterSkeleton = await passUntil(table, views, game => game.activeWindow?.kind === 'follower-start'
      && game.currentAttack?.targetId === d, 400);
    const persisted = await storedGame(request, table.roomId); const group = persisted.groups?.[afterSkeleton.currentAttack!.groupId]!;
    const bTarget = group.targets.find(target => target.actorId === b)!;
    expect(group.sourceCardInstanceIds).toEqual(['a2-p21-r2c3', 'a2-p21-r2c1']);
    expect(bTarget.followerSnapshot).toEqual(['a2-p19-r2c1']);
    expect(bTarget.followerDefense).toHaveLength(1);
    expect(bTarget.followerDefense![0]).toMatchObject({
      cardInstanceId: 'a2-p19-r2c1', levels: [3, 3, 3],
      hits: [
        { hitIndex: 0, outcome: 'lower-destroyed', hpReduction: 4 },
        { hitIndex: 1, outcome: 'lower-destroyed', hpReduction: 4 },
        { hitIndex: 2, outcome: 'lower-destroyed', hpReduction: 4 },
      ],
    });
    expect(bTarget.hits.map(hit => ({ source: hit.sourceCardInstanceId, damage: hit.damage }))).toEqual([
      { source: 'a2-p21-r2c3', damage: 2 }, { source: 'a2-p21-r2c3', damage: 2 }, { source: 'a2-p21-r2c3', damage: 2 },
    ]);
    expect(persisted.resolution).toEqual(expect.arrayContaining(['a2-p21-r2c3', 'a2-p21-r2c1']));
    expect(allCardInstanceIds(persisted)).toHaveLength(220); expect(new Set(allCardInstanceIds(persisted)).size).toBe(220);

    const done = await passUntil(table, views, game => !game.activeWindow, 400);
    expect(done.players[b]!.damage).toBe(6); expect(done.players[d]!.damage).toBe(6);
    expect(done.players[b]!.followers).toContainEqual(expect.objectContaining({ cardInstanceId: 'a2-p19-r2c1' }));
  } finally { await table.close(); }
});

for (const wholeGrant of [true, false]) test(`Fate cancels ${wholeGrant ? 'the entire grant' : 'only one constituent'} while every selected source remains spent`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, wholeGrant ? 'follower-group-grant-cancel' : 'follower-group-source-cancel');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[0]!;
    const panel = page.getByRole('region', { name: '複数従者の攻撃' }); await selectUpa(panel);
    await panel.getByRole('button', { name: '選んだ従者で攻撃する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.followerBundle?.sources.length).toBe(2);
    await passUntil(table, views, game => game.activeWindow?.pendingActorId === b && (wholeGrant ? !!game.reactionTargetAbilityId : game.currentAction?.source === 'card' && game.currentAction.cardInstanceId === 'a2-p20-r3c1' && game.currentAction.stage === 'declaration'), 400);
    await table.pages[1]!.reload(); await table.pages[1]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    const revision = views.get(a)!.revision; await table.pages[1]!.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(revision);
    const done = await passUntil(table, views, game => !game.activeWindow, 400);
    expect(done.players[b]!.damage).toBe(wholeGrant ? 0 : 12);
    expect(done.discard).toEqual(expect.arrayContaining(['a2-p20-r3c1', 'a2-p22-r2c2']));
    expect(done.self.followers).toEqual([]); expect(done.followerBundle).toBeNull();
  } finally { await table.close(); }
});

test('Royal Guard reflects the actual low source and resumes the higher independent source after reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-group-reflect');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[0]!;
    const panel = page.getByRole('region', { name: '複数従者の攻撃' });
    await panel.getByRole('combobox', { name: '使う能力', exact: true }).selectOption('c2-p06-r1c2-ab04');
    for (const [id, name] of [['a2-p18-r3c3', '兵士（配置中）'], ['a2-p21-r2c1', '闇の聖女（手札）']] as const) {
      await addSource(panel, id); await panel.getByRole('group', { name, exact: true }).getByRole('radio', { name: '楓', exact: true }).check();
    }
    await panel.getByRole('button', { name: '選んだ従者で攻撃する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.followerBundle?.sources.length).toBe(2);
    const returned = await passUntil(table, views, game => game.currentAction?.source === 'follower' && game.activeWindow?.kind === 'normal-defense', 400);
    expect(returned.currentAttack?.technique.effectLevel).toBe(1); expect(returned.currentAttack?.technique.damage).toBe(1);
    await page.reload(); await expect(page.getByRole('region', { name: '現在の行動' })).toContainText('王立騎士団による反射');
    const done = await passUntil(table, views, game => !game.activeWindow, 400);
    expect(done.players[a]!.damage).toBe(1); expect(done.players[b]!.damage).toBe(0);
    expect(done.discard).toEqual(expect.arrayContaining(['a2-p18-r3c3', 'a2-p21-r2c1']));
  } finally { await table.close(); }
});

test('Water Dragon stop persists through the victim turn and expires at the source seat arrival', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-group-water');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[0]!;
    const panel = page.getByRole('region', { name: '複数従者の攻撃' }); await selectUpa(panel, 'a2-p23-r1c1');
    await panel.getByRole('button', { name: '選んだ従者で攻撃する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.followerBundle?.sources.length).toBe(2);
    await passUntil(table, views, game => !game.activeWindow, 400);
    await table.pages[1]!.reload(); await expect(table.pages[1]!.getByRole('region', { name: '楓の状態異常', exact: true })).toContainText('使用者の次の手番');
    let visitedVictim = false; let expired = false;
    for (let step = 0; step < 150; step++) {
      const current = views.get(a)!; const game = current.game!;
      if (visitedVictim && game.turnSeat === 0 && !game.players[b]!.statuses.some(status => status.timing === 'source-turn')) { expired = true; break; }
      const actingId = game.activeWindow?.pendingActorId ?? game.seatOrder[game.turnSeat]!;
      const actingPage = table.pages[table.sessions.findIndex(session => session.id === actingId)]!;
      if (game.turnSeat === 1) { visitedVictim = true; expect(game.players[b]!.statuses.some(status => status.timing === 'source-turn')).toBe(true); }
      if (game.activeWindow) await actingPage.getByRole('button', { name: windowPassButtonName }).click();
      else {
        const names: Record<string, string | RegExp> = { withdrawal: '離脱しない', 'hand-adjustment': /^選んだ0枚を捨てて手番を終える$/, 'turn-start': '手番を始める', draw: 'カードを引かない', action: '行動を終える' };
        await actingPage.getByRole('button', { name: names[game.phase]!, exact: true }).click();
      }
      await expect.poll(() => views.get(a)?.revision).toBeGreaterThan(current.revision);
    }
    expect(visitedVictim).toBe(true); expect(expired).toBe(true);
  } finally { await table.close(); }
});

test('Dia uses ordinary white Fairies with a saved level die before use checks and a separate damage die', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'follower-group-fairy');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const b = table.sessions[1]!.id; const page = table.pages[0]!;
    const panel = page.getByRole('region', { name: '複数従者の攻撃' });
    await panel.getByRole('combobox', { name: '使う能力', exact: true }).selectOption('c2-p06-r1c2-ab04');
    await addSource(panel, 'a2-p21-r3c3');
    const fairy = panel.getByRole('group', { name: '妖精族（手札）', exact: true });
    await expect(fairy.getByRole('checkbox')).toHaveCount(0); await fairy.getByRole('radio', { name: '楓', exact: true }).check();
    await panel.getByRole('button', { name: '選んだ従者で攻撃する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.followerBundle?.sources.length).toBe(1);
    const level = await passUntil(table, views, game => game.currentRoll?.purpose === 'technique-value' && game.currentRoll.stage === 'after-roll', 400);
    const levelId = level.currentRoll!.rollId; const levelFace = level.currentRoll!.faces[0]!;
    await page.reload();
    await passUntil(table, views, game => game.currentRoll?.purpose === 'excess-level', 400);
    const damage = await passUntil(table, views, game => game.currentRoll?.purpose === 'attack-damage' && game.currentRoll.stage === 'after-roll', 400);
    const damageFace = damage.currentRoll!.faces[0]!; expect(damage.currentRoll!.rollId).not.toBe(levelId);
    const defense = await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense', 400);
    expect(currentCardAction(defense)?.technique.useLevel).toBe(3 + levelFace);
    expect(currentCardAction(defense)?.technique.effectLevel).toBe(3 + levelFace);
    const done = await passUntil(table, views, game => !game.activeWindow, 400);
    expect(done.players[b]!.damage).toBe(4 + damageFace);
    expect(done.players[table.sessions[3]!.id]!.damage).toBe(0);
  } finally { await table.close(); }
});
