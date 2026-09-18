import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

test('a real final death shows a persisted result to winners and the defeated player', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lifecycle-finish');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id;
    await passUntil(table, views, game => game.outcome !== null);
    await expect.poll(() => views.get(owner)?.status).toBe('finished');
    for (const page of table.pages) await expect(page.getByRole('status', { name: '対戦結果' })).toContainText('勝利条件が満たされました');
    const result = views.get(owner)!.game!.outcome;
    expect(result?.results[table.sessions[1]!.id]).toBe('lost');
    await table.pages[1]!.reload();
    await expect(table.pages[1]!.getByRole('status', { name: '対戦結果' })).toContainText('楓 · 敗北');
    expect(views.get(table.sessions[1]!.id)!.game!.outcome).toEqual(result);
    await expect(table.pages[0]!.getByRole('button', { name: '手番を始める', exact: true })).toHaveCount(0);
  } finally { await table.close(); }
});

test('Dia can explicitly hand the ritual to revealed Uonos during a lifecycle boundary', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'ritual-transfer');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const recipient = table.sessions[1]!.id;
    const before = views.get(owner)!.game!.self.hand.length;
    await table.pages[2]!.getByRole('button', { name: '正体を公開', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.lifecycleDecision).toMatchObject({ kind: 'lifecycle-boundary', actorId: owner });
    expect(views.get(owner)!.game!.legalChoices).toContain('TRANSFER_RITUAL');
    const ritualRecipient = table.pages[0]!.getByLabel('儀式を渡す相手');
    await expect(ritualRecipient).toBeVisible({ timeout: 2_000 });
    await ritualRecipient.selectOption(recipient);
    await table.pages[0]!.getByRole('button', { name: '復活の儀式を渡す', exact: true }).click();
    await expect.poll(() => views.get(recipient)?.game?.self.hand.includes('a2-p05-r1c1')).toBe(true);
    expect(views.get(owner)!.game!.self.hand).toHaveLength(before - 1);
    expect(views.get(owner)!.game!.activeWindow?.kind).toBe('lifecycle-boundary');
    expect(views.get(owner)!.game!.legalChoices).not.toContain('TRANSFER_RITUAL');
  } finally { await table.close(); }
});


async function hiddenTransformation(browser: Parameters<typeof tableFixture>[0], request: Parameters<typeof tableFixture>[1], use: boolean) {
  const table = await tableFixture(browser, request, 'lifecycle-transform-hidden');
  try {
    const views = await observe(table), owner = table.sessions[0]!.id;
    async function click(seat: number, label: string) {
      const revision = views.get(owner)!.revision;
      await table.pages[seat]!.getByRole('button', { name: label, exact: true }).click();
      await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
    }
    async function reload(seat: number) {
      const before = structuredClone(views.get(table.sessions[seat]!.id)!.game);
      await table.pages[seat]!.reload();
      await expect(table.pages[seat]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
      expect(views.get(table.sessions[seat]!.id)!.game).toEqual(before);
    }
    function hidden() {
      for (const session of table.sessions.slice(1)) {
        const game = views.get(session.id)!.game!;
        expect(game.players[owner]).not.toHaveProperty('characterId');
        expect(game.lifecycleAbilities).not.toContain('lancelot-transform');
      }
    }
    await click(1, '正体を公開');
    await passUntil(table, views, game => !game.activeWindow);
    hidden(); await reload(0);
    await expect(table.pages[0]!.getByRole('button', { name: 'ランスロットⅡへ変身する', exact: true })).toBeEnabled();
    if (use) {
      await click(0, 'ランスロットⅡへ変身する');
      await reload(0);
      await passUntil(table, views, game => !game.activeWindow);
    } else {
      await click(0, '行動を終える');
      const self = views.get(owner)!.game!.self, excess = Math.max(0, self.hand.length - self.stats.handLimit);
      for (let n = 0; n < excess; n++) await table.pages[0]!.getByRole('region', { name: '自分の手札' }).getByRole('article').nth(n).getByRole('button').first().click();
      await click(0, `選んだ${excess}枚を捨てて手番を終える`);
    }
    await reload(0); await reload(1);
    expect(views.get(owner)!.game!.self.characterId).toBe(use ? 'c2-p07-r1c1' : 'c2-p02-r2c2');
    expect(views.get(owner)!.game!.players[owner]!.revealed).toBe(use);
    if (!use) { hidden(); expect(views.get(owner)!.game!.turnSeat).toBe(1); }
  } finally { await table.close(); }
}
