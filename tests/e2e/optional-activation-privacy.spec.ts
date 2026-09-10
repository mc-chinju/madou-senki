import { expect, test, type Browser, type APIRequestContext } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

async function exercise(browser: Browser, request: APIRequestContext, use: boolean) {
  const table = await tableFixture(browser, request, 'ability-critical');
  try {
    const views = await observe(table);
    const owner = table.sessions[0]!.id, target = table.sessions[1]!.id;
    function privateViews() {
      for (const session of table.sessions.slice(1)) {
        const game = views.get(session.id)!.game!;
        expect(game.players[owner]).not.toHaveProperty('characterId');
        expect(JSON.stringify(game)).not.toContain('c2-p04-r2c2');
      }
    }
    await expect(table.pages[0]!.getByRole('button', { name: '必殺を使う', exact: true })).toBeVisible();
    privateViews();
    let faces: number[] = [];
    if (use) {
      await table.pages[0]!.getByRole('button', { name: '必殺を使う', exact: true }).click();
      await expect.poll(() => views.get(target)?.game?.currentAction?.source).toBe('ability');
      expect(views.get(target)!.game!.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
      privateViews();
      const rolled = await passUntil(table, views, game => game.currentRoll?.purpose === 'ability-value' && game.currentRoll.stage === 'after-roll');
      faces = [...rolled.currentRoll!.faces];
      expect(faces).toHaveLength(2);
    }
    await table.pages[0]!.reload();
    if (use) await expect(table.pages[0]!.getByRole('region', { name: 'サイコロの結果' })).toContainText('特殊能力のサイコロ');
    else await expect(table.pages[0]!.getByRole('button', { name: '必殺を使う', exact: true })).toBeVisible();
    await table.pages[1]!.reload();
    await expect.poll(() => views.get(target)?.game?.players[owner]?.revealed).toBe(false);
    privateViews();
    const done = await passUntil(table, views, game => !game.activeWindow);
    if (use && faces[0] === faces[1]) expect(done.players[target]!.presence).toBe('dead');
    else expect(done.players[target]!.damage).toBe(use && Math.abs(faces[0]! - faces[1]!) === 1 ? 8 : 4);
    expect(done.players[owner]!.revealed).toBe(false);
    privateViews();
    for (const page of table.pages.slice(1)) await expect(page.getByRole('button', { name: '必殺を使う', exact: true })).toHaveCount(0);
  } finally { await table.close(); }
}

test('G09 passing optional critical after reload preserves concealed identity and ordinary damage', async ({ browser, request }) => {
  await exercise(browser, request, false);
});
test('G09 explicitly using critical remains concealed through roll reload and resolution', async ({ browser, request }) => {
  await exercise(browser, request, true);
});
