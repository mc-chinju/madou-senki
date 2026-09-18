import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

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

