import { expect, test } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

test('death gift distinguishes the spent card, transfers privately and survives reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'death-gift');
  try {
    const views = await observe(table); const [a, b, c] = table.sessions.map(session => session.id) as [string, string, string];
    const page = table.pages[1]!; const original = views.get(b)!.game!.self.hand.length;
    await expect(page.getByRole('complementary', { name: '死亡時の贈与' })).toBeVisible();
    await page.getByLabel('死亡時に使うカード').selectOption('a2-p02-r3c2');
    await expect(page.getByLabel('相手に託す手札').locator('option[value="a2-p02-r3c2"]')).toHaveCount(0);
    await page.getByLabel('相手に託す手札').selectOption('a2-p05-r2c3');
    await page.getByLabel('カードを託す相手').selectOption(c);
    await page.getByRole('button', { name: '選んだ手札を託す', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.activeWindow?.kind).toBe('declaration');
    expect(views.get(b)!.game!.self.hand).toHaveLength(original - 1);
    expect(JSON.stringify(views.get(a))).not.toContain('a2-p05-r2c3');
    await page.reload(); await expect(page.getByRole('region', { name: '自分の手札' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: '死亡時の贈与' })).toHaveCount(0);
    await passUntil(table, views, game => game.players[b]!.presence === 'dead' && !game.activeWindow);
    await expect(table.pages[2]!.getByRole('region', { name: '自分の手札' }).getByRole('button', { name: '必勝の祈り', exact: true })).toBeVisible();
    expect(JSON.stringify(views.get(a))).not.toContain('a2-p05-r2c3');
    expect(views.get(b)!.game!.self.hand).toEqual([]);
  } finally { await table.close(); }
});

test('a third party can cancel the death gift before its private hand transfer', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'death-gift');
  try {
    const views = await observe(table); const [a, b, c] = table.sessions.map(session => session.id) as [string, string, string];
    const page = table.pages[1]!;
    await page.getByLabel('死亡時に使うカード').selectOption('a2-p02-r3c2');
    await page.getByLabel('相手に託す手札').selectOption('a2-p05-r2c3');
    await page.getByLabel('カードを託す相手').selectOption(c);
    await page.getByRole('button', { name: '選んだ手札を託す', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.activeWindow?.kind).toBe('declaration');
    await passUntil(table, views, game => game.activeWindow?.pendingActorId === a);
    await table.pages[0]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await table.pages[0]!.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.self.hand.includes('a2-p02-r2c3')).toBe(false);
    await passUntil(table, views, game => game.players[b]!.presence === 'dead' && !game.activeWindow);
    expect(views.get(c)!.game!.self.hand).not.toContain('a2-p05-r2c3');
    expect(views.get(a)!.game!.discard).toContain('a2-p05-r2c3');
  } finally { await table.close(); }
});

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

test('opposing otherworld survivors finish as a persisted stalemate and can still inspect cards', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lifecycle-stalemate');
  try {
    const views = await observe(table); const [a, b, c] = table.sessions.map(session => session.id) as [string, string, string];
    await passUntil(table, views, game => !game.activeWindow);
    await expect.poll(() => views.get(a)?.status).toBe('finished');
    for (const page of table.pages) {
      const result = page.getByRole('status', { name: '対戦結果' });
      await expect(result).toContainText('進行不能による引き分け');
      await expect(result).not.toContainText('双方が同時に全滅');
    }
    const result = views.get(a)!.game!.outcome;
    expect(result).toMatchObject({ kind: 'draw', reason: 'stalemate', winnerIds: [] });
    expect(views.get(a)!.game!.players[b]!.presence).toBe('otherworld');
    expect(views.get(a)!.game!.players[c]!.presence).toBe('otherworld');
    await table.pages[1]!.reload();
    await expect(table.pages[1]!.getByRole('status', { name: '対戦結果' })).toContainText('進行不能による引き分け');
    expect(views.get(b)!.game!.outcome).toEqual(result);
    await expect(table.pages[1]!.getByRole('button', { name: '手番を始める', exact: true })).toHaveCount(0);
    await table.pages[1]!.getByRole('region', { name: '自分の手札' }).getByRole('button', { name: /の詳細を見る/ }).first().click();
    await expect(table.pages[1]!.getByRole('dialog')).toBeVisible();
  } finally { await table.close(); }
});

test('Fusen revival resumes its original draw after reload and follower re-setup', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'fusen-revival');
  try {
    const views = await observe(table); const [a, b, c] = table.sessions.map(session => session.id) as [string, string, string];
    await expect(table.pages[1]!.getByRole('region', { name: 'サイコロの結果' })).toContainText('伏線の復活判定');
    expect(views.get(a)!.game!.currentRoll).toMatchObject({ formula: 'd6', threshold: 4, total: 1 });
    await passUntil(table, views, game => game.lifecycleDecision?.kind === 'revival');
    await table.pages[1]!.reload();
    await expect(table.pages[1]!.getByRole('button', { name: '復活する', exact: true })).toBeEnabled();
    await table.pages[1]!.getByRole('button', { name: '復活する', exact: true }).click();
    await expect(table.pages[1]!.getByRole('complementary', { name: '復帰後の従者配置' })).toBeVisible();
    await table.pages[1]!.getByLabel('配置する従者').selectOption({ label: '兵士' });
    await table.pages[1]!.getByRole('button', { name: 'この従者を配置する', exact: true }).click();
    await expect.poll(() => views.get(b)?.game?.self.followers.length).toBe(1);
    await table.pages[1]!.getByRole('button', { name: '従者の配置を終える', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.lifecycleDecision).toBeNull();
    expect(views.get(b)!.game!.self.hand).toHaveLength(5);
    expect(views.get(a)!.game!.players[b]).toMatchObject({ presence: 'active', revealed: true, damage: 0 });
    expect(views.get(c)!.game!.turnSeat).toBe(2);
    expect(views.get(c)!.game!.phase).toBe('action');
  } finally { await table.close(); }
});

test('Lancelot can transform after passing the full Lia boundary without a raw reaction command', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'lifecycle-transform');
  try {
    const views = await observe(table); const owner = table.sessions[0]!.id;
    await table.pages[1]!.getByRole('button', { name: '正体を公開', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.lifecycleDecision?.kind).toBe('lifecycle-boundary');
    await passUntil(table, views, game => !game.activeWindow);
    expect(views.get(owner)!.game!.lifecycleDecision).toBeNull();
    await expect(table.pages[0]!.getByRole('button', { name: 'ランスロットⅡへ変身する', exact: true })).toBeEnabled({ timeout: 2_000 });

    await table.pages[0]!.getByRole('region', { name: '自分の手札' }).getByRole('button', { name: '踏み込み／弓', exact: true }).click();
    await table.pages[0]!.getByRole('article').filter({ has: table.pages[0]!.getByRole('heading', { name: '蓮', exact: true }) }).getByRole('checkbox').check();
    await table.pages[0]!.getByRole('button', { name: '攻撃を確認して実行', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.activeWindow?.kind).toBe('declaration');
    await passUntil(table, views, game => game.activeWindow?.pendingActorId === owner);
    expect(views.get(owner)!.game!.lifecycleDecision).toBeNull();
    expect(views.get(owner)!.game!.legalChoices).toContain('USE_LIFECYCLE_ABILITY');
    await expect(table.pages[0]!.getByRole('button', { name: 'USE_LIFECYCLE_ABILITY', exact: true })).toHaveCount(0);
    await expect(table.pages[0]!.getByRole('button', { name: 'ランスロットⅡへ変身する', exact: true })).toBeEnabled();
    const hand = views.get(owner)!.game!.self.hand;
    await table.pages[0]!.getByRole('button', { name: 'ランスロットⅡへ変身する', exact: true }).click();
    await expect.poll(() => views.get(owner)?.game?.currentAction?.source).toBe('ability');
    await passUntil(table, views, game => game.players[owner]!.characterId === 'c2-p07-r1c1');
    await expect(table.pages[0]!.getByRole('heading', { name: '聖騎士ランスロット2', exact: true })).toBeVisible();
    expect(views.get(owner)!.game!.self.hand).toEqual(hand);
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


test('Uonos performs the ritual, selects subordinates and Arseil wins individually while play continues', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'ritual-use', 5);
  try {
    const views = await observe(table); const [a, b, c] = table.sessions.map(session => session.id) as [string, string, string];
    await table.pages[0]!.getByRole('button', { name: '儀式を行い、ヴァンミールへ変身する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.activeWindow?.kind).toBe('declaration');
    await passUntil(table, views, game => game.lifecycleDecision?.kind === 'lifecycle-boundary');
    await expect(table.pages[0]!.getByRole('heading', { name: '破壊神ヴァンミール', exact: true })).toBeVisible();
    expect(views.get(a)!.game!.self.damage).toBe(0);
    expect(views.get(a)!.game!.self.stats.endurance).toBe(25);
    await table.pages[0]!.getByRole('button', { name: '下僕達を使う', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.currentAction?.source).toBe('ability');
    await passUntil(table, views, game => game.currentAction?.source !== 'ability');
    await expect.poll(() => views.get(b)?.game?.self.faction).toBe('ヴァンミール');
    await passUntil(table, views, game => game.activeWindow?.pendingActorId === c);
    await table.pages[2]!.getByRole('button', { name: '陰謀を使い、勝利して退場する', exact: true }).click();
    await expect.poll(() => views.get(a)?.game?.currentAction?.source).toBe('ability');
    await passUntil(table, views, game => game.individualResults[c] === 'won');
    await expect.poll(() => views.get(a)?.game?.individualResults[c]).toBe('won');
    await passUntil(table, views, game => !game.activeWindow);
    expect(views.get(a)!.game!.players[c]!.presence).toBe('exited');
    expect(views.get(a)!.status).toBe('playing');
    expect(views.get(a)!.game!.outcome).toBeNull();
    await expect(table.pages[2]!.getByRole('region', { name: '個人の勝利' })).toContainText('対戦は続きます');
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
test('G09 hidden Lancelot declines transformation through turn end and reload', async ({ browser, request }) => {
  await hiddenTransformation(browser, request, false);
});
test('G09 hidden Lancelot explicitly transforms and publishes only after use', async ({ browser, request }) => {
  await hiddenTransformation(browser, request, true);
});
