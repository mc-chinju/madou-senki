import { expect, test } from '@playwright/test';
import { observe, tableFixture, windowPassButtonName } from './helpers.js';

/** G03: a later seat may pass while an earlier seat still holds priority; only real plays keep the seat order. */
test('a later seat passes first and the priority seat still plays its card without a retry', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'third-party-interrupt');
  try {
    const views = await observe(table);
    const owner = table.sessions[0]!.id, third = table.sessions[2]!, last = table.sessions[3]!;
    const game = () => views.get(owner)!.game!;
    await expect.poll(() => game().activeWindow?.pendingActorId).toBe(third.id);

    // The last seat answers out of order; priority stays where it is and the window generation does not move.
    const generation = game().activeWindow!.windowRevision;
    const before = views.get(owner)!.revision;
    const decisionBar = table.pages[3]!.getByRole('complementary', { name: '現在の判断' });
    await expect(decisionBar.getByRole('region', { name: 'この確認の回答状況' })).toContainText('先にパスできます');
    await decisionBar.getByRole('button', { name: 'パス（この確認だけ）', exact: true }).click();
    await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(before);
    expect(game().activeWindow).toMatchObject({ pendingActorId: third.id, windowRevision: generation });
    await expect(decisionBar.getByRole('region', { name: 'この確認の回答状況' })).toContainText('パス済みです');

    // The card that arrives after that pass is accepted; nothing is rejected as stale.
    const decision = table.pages[2]!.getByRole('complementary', { name: '現在の判断' });
    await decision.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption('cancel');
    await decision.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    const played = views.get(owner)!.revision;
    await decision.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(played);
    for (const page of table.pages) await expect(page.getByRole('alert')).toHaveCount(0);

    // The intervention changed the situation, so the pass given ahead is gone and the seat is asked again.
    await expect.poll(() => views.get(last.id)!.game!.legalChoices).toContain('PASS');
  } finally { await table.close(); }
});

/** G03: leaving a whole action keeps the third parties out of every later window of that action. */
test('two third parties leave the action and the attack runs on the two sides alone', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'third-party-interrupt');
  try {
    const views = await observe(table);
    const owner = table.sessions[0]!.id, third = table.sessions[2]!, last = table.sessions[3]!;
    const game = () => views.get(owner)!.game!;
    for (const seat of [3, 2]) {
      const before = views.get(owner)!.revision;
      await table.pages[seat]!.getByRole('complementary', { name: '現在の判断' })
        .getByRole('button', { name: 'この行動は任せる', exact: true }).click();
      await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(before);
    }
    // Every later window of the attack is filled in for them, so only the two sides are ever asked.
    let defended = false;
    for (let step = 0; step < 40 && game().activeWindow; step++) {
      const current = views.get(owner)!, pending = current.game!.activeWindow!.pendingActorId;
      // The death/revival boundary keeps every seat by design; the attack's own windows must not.
      if (current.game!.activeWindow!.kind !== 'lifecycle-boundary')
        expect([third.id, last.id], 'a seat that left the action is never asked again').not.toContain(pending);
      defended ||= current.game!.activeWindow!.kind === 'normal-defense';
      const page = table.pages[table.sessions.findIndex(session => session.id === pending)]!;
      await page.getByRole('button', { name: windowPassButtonName }).click();
      await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(current.revision);
    }
    // The attack reached its hit and left combat with no third-party click at all.
    expect(defended, 'the defender was asked for its own defense').toBe(true);
    expect(game().activeWindow).toBeNull();
    expect(views.get(table.sessions[1]!.id)!.game!.players[table.sessions[1]!.id]!.damage).toBeGreaterThan(0);
    for (const id of [third.id, last.id]) expect(views.get(id)!.game!.legalChoices).not.toContain('PASS');
    await expect(table.pages[0]!.getByRole('region', { name: '公開ログ' })).toContainText('がこの行動を任せました');
  } finally { await table.close(); }
});
