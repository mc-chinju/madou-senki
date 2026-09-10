import { expect, test, type Browser, type APIRequestContext } from '@playwright/test';
import { observe, tableFixture } from './helpers.js';
async function exercise(browser: Browser, request: APIRequestContext, scenario: 'suppression-hidden-ordinary' | 'follower-attack-griffin') {
  const table = await tableFixture(browser, request, scenario);
  try {
    const views = await observe(table), owner = table.sessions[0]!.id;
    const before = structuredClone(views.get(owner)!.game!);
    if (scenario === 'suppression-hidden-ordinary') expect(before.abilityOptions.some(o => o.abilityId === 'c2-p07-r1c2-ab03')).toBe(true);
    else expect(before.followerBundleOptions.some(o => o.abilityId === 'c2-p05-r1c2-ab02')).toBe(true);
    function privacy() {
      for (const session of table.sessions.slice(1)) {
        const view = views.get(session.id)!.game!;
        expect(view.followerBundleOptions).toEqual([]);
        expect(view.abilityOptions.some(o => o.abilityId === 'c2-p07-r1c2-ab03')).toBe(false);
        if (!before.players[owner]!.revealed) expect(view.players[owner]).not.toHaveProperty('characterId');
      }
    }
    async function reload(seat: number) {
      const saved = structuredClone(views.get(table.sessions[seat]!.id)!.game);
      await table.pages[seat]!.reload();
      await expect(table.pages[seat]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
      expect(views.get(table.sessions[seat]!.id)!.game).toEqual(saved);
    }
    async function click(name: string) {
      const revision = views.get(owner)!.revision;
      await table.pages[0]!.getByRole('button', { name, exact: true }).click();
      await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
    }
    privacy(); await reload(0);
    if (before.phase === 'action') await click('行動を終える');
    const excess = Math.max(0, before.self.hand.length - before.self.stats.handLimit);
    for (let n = 0; n < excess; n++) await table.pages[0]!.getByRole('region', { name: '自分の手札' }).getByRole('article').nth(n).getByRole('button').first().click();
    await click(`選んだ${excess}枚を捨てて手番を終える`);
    await reload(0); await reload(1);
    const done = views.get(owner)!.game!;
    expect(done.phase).toBe('turn-start'); expect(done.turnSeat).toBe(1);
    expect(done.self.followers).toEqual(before.self.followers);
    expect(done.self.hand).toHaveLength(before.self.stats.handLimit);
    expect(done.self.hand.slice(0, before.self.hand.length - excess)).toEqual(before.self.hand.slice(excess));
    expect(done.players).toEqual({ ...before.players, [owner]: { ...before.players[owner], handCount: before.self.stats.handLimit } });
    privacy();
  } finally { await table.close(); }
}
test('G09 Vanmil ends without designating suppression after reload', async ({ browser, request }) => {
  await exercise(browser, request, 'suppression-hidden-ordinary');
});
test('G09 hidden Upa ends without reserving follower attacks after reload', async ({ browser, request }) => {
  await exercise(browser, request, 'follower-attack-griffin');
});
