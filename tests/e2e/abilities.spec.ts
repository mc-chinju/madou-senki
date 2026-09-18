import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

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

