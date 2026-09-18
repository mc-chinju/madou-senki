import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

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

