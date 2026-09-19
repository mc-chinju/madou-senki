import { test, expect } from '@playwright/test';
import { tableFixture, observe, passUntil } from './helpers.js';

test('a roll can be rerolled after reload without revealing another player’s threshold', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'roll-check');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id; const page = table.pages[0]!;
    const original = views.get(owner)!.game!.currentRoll!;
    expect(original.faces).toEqual([6, 6]); expect(original.threshold).toBe(8);
    const roll = page.getByRole('region', { name: 'サイコロの結果', exact: true });
    await expect(roll).toContainText('6 + 6 = 12');
    await expect(roll).toContainText('目標値: 8以下');
    for (const session of table.sessions.slice(1)) {
      const other = views.get(session.id)!.game!.currentRoll!;
      // G03 判定の公開範囲: the outcome reaches every seat, the threshold stays with a revealed one.
      expect(other.threshold).toBeUndefined(); expect(other.success).toBe(original.success);
      expect(other.attempts.map(attempt => attempt.success)).toEqual(original.attempts.map(attempt => attempt.success));
    }
    await expect(table.pages[1]!.getByRole('region', { name: 'サイコロの結果', exact: true })).not.toContainText('目標値:');
    const decision = page.getByRole('complementary', { name: '現在の判断' });
    await decision.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption('reroll');
    await decision.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r1c3');
    await decision.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.self.hand.includes('a2-p02-r1c3')).toBe(false);
    const saved = views.get(owner)!; await page.reload();
    await expect(page.getByRole('region', { name: '自分の手札' })).toBeVisible();
    expect(views.get(owner)!.revision).toBe(saved.revision);
    const game = await passUntil(table, views, current => current.activeWindow?.kind === 'after-roll' && current.currentRoll?.rollId === original.rollId && current.currentRoll.generation === 1);
    expect(game.currentRoll!.attempts).toHaveLength(2);
    expect(game.currentRoll!.faces).toHaveLength(2);
    expect(game.currentRoll!.total).toBe(game.currentRoll!.faces.reduce((sum, face) => sum + face, 0));
    expect(game.currentRoll!.threshold).toBe(8);
    expect(game.self.stats.spirit).toBeGreaterThan(8);
    await expect(roll).toContainText('振り直し 1回');
  } finally { await table.close(); }
});

