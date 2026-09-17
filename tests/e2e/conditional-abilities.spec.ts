import { expect, test, type Locator } from '@playwright/test';
import { allCardInstanceIds, type GameState } from '../../packages/engine/src/index.js';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { conditionalScenarioNames, type ConditionalScenarioName } from '../../apps/worker/test/fixtures/conditional-ability-scenarios.js';
import { observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
const entries: Record<ConditionalScenarioName, { name: string; id: string; seat: number }> = {
  'conditional-tia-public': { name: 'ティアがんばる', id: 'c2-p02-r1c1-ab04', seat: 0 },
  'conditional-tia-hidden': { name: 'ティアがんばる', id: 'c2-p02-r1c1-ab04', seat: 0 },
  'conditional-lia-public': { name: 'この世界に愛を', id: 'c2-p03-r1c2-ab03', seat: 0 },
  'conditional-lia-hidden': { name: 'この世界に愛を', id: 'c2-p03-r1c2-ab03', seat: 0 },
  'conditional-lia-lance-ii': { name: 'この世界に愛を', id: 'c2-p03-r1c2-ab03', seat: 0 },
  'conditional-arnes-attack': { name: '男ごときが', id: 'c2-p03-r2c2-ab04', seat: 0 },
  'conditional-arnes-defense': { name: '男ごときが', id: 'c2-p03-r2c2-ab04', seat: 1 },
  'conditional-asfelt-dragon': { name: '竜皇子', id: 'c2-p04-r1c2-ab03', seat: 1 },
  'conditional-asfelt-truth': { name: '真実', id: 'c2-p04-r1c2-ab05', seat: 0 },
  'conditional-upa-attack': { name: '獣性', id: 'c2-p05-r1c2-ab01', seat: 0 },
  'conditional-garwin-rival': { name: '我がライバル', id: 'c2-p05-r2c1-ab05', seat: 0 },
  'conditional-dia-public': { name: '闇の聖女達の情報', id: 'c2-p06-r1c2-ab02', seat: 0 },
  'conditional-dia-hidden': { name: '闇の聖女達の情報', id: 'c2-p06-r1c2-ab02', seat: 0 },
};
function setting(table: Table, views: Map<string, RoomView>, entry: typeof entries[ConditionalScenarioName]) {
  return views.get(table.sessions[entry.seat]!.id)!.game!.conditionalAbilities.find(option => option.abilityId === entry.id)!;
}
function panel(table: Table, entry: typeof entries[ConditionalScenarioName]) {
  return table.pages[entry.seat]!.getByRole('region', { name: '継続する特殊能力' }).getByRole('group', { name: entry.name, exact: true });
}
async function click(table: Table, views: Map<string, RoomView>, button: Locator) {
  const revision = views.get(table.sessions[0]!.id)!.revision;
  await button.click(); await expect.poll(() => views.get(table.sessions[0]!.id)?.revision).toBeGreaterThan(revision);
}
async function activate(table: Table, views: Map<string, RoomView>, entry: typeof entries[ConditionalScenarioName]) {
  const choice = panel(table, entry);
  if (entry.name === 'この世界に愛を') await choice.getByRole('checkbox', { name: '楓', exact: true }).check();
  await click(table, views, choice.getByRole('button', { name: '使用する設定を宣言', exact: true }));
  await passUntil(table, views, () => setting(table, views, entry).enabled, 500);
}
for (const scenario of conditionalScenarioNames) test(`${scenario}: actual ON/OFF controls survive reload and remain private`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, scenario);
  try {
    const views = await observe(table); const entry = entries[scenario]; const choice = panel(table, entry);
    await expect(choice).toContainText('使用しない設定です。');
    expect(setting(table, views, entry).enabled).toBe(false);
    await activate(table, views, entry);
    await table.pages[entry.seat]!.reload(); await expect(choice).toContainText('使用する設定を保持しています。');
    for (const [seat, page] of table.pages.entries()) if (seat !== entry.seat) {
      expect(views.get(table.sessions[seat]!.id)!.game!.conditionalAbilities.some(option => option.abilityId === entry.id)).toBe(false);
      await expect(page.getByRole('region', { name: '継続する特殊能力' }).getByRole('group', { name: entry.name, exact: true })).toHaveCount(0);
    }
    await passUntil(table, views, () => setting(table, views, entry).canDeactivate, 500);
    await click(table, views, choice.getByRole('button', { name: '使用しない設定に戻す', exact: true }));
    await expect(choice).toContainText('使用しない設定です。');
    const state = await (await request.get(`/__test/rooms/${table.roomId}/game`)).json() as GameState;
    const cards = allCardInstanceIds(state); expect(cards).toHaveLength(220); expect(new Set(cards).size).toBe(220);
  } finally { await table.close(); }
});

test('Tia reserved while Lester is hidden activates only after an actual reveal', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'conditional-tia-hidden');
  try {
    const views = await observe(table); const entry = entries['conditional-tia-hidden']; const a = table.sessions[0]!.id;
    const base = views.get(a)!.game!.self.stats.spirit;
    await activate(table, views, entry); await passUntil(table, views, game => !game.activeWindow, 500);
    expect(views.get(a)!.game!.self.stats.spirit).toBe(base);
    expect(JSON.stringify(views.get(a))).not.toContain('c2-p03-r2c1');
    await click(table, views, table.pages[1]!.getByRole('button', { name: '正体を公開', exact: true }));
    await passUntil(table, views, game => !game.activeWindow, 500);
    expect(views.get(a)!.game!.self.stats.spirit).toBe(base + 1);
  } finally { await table.close(); }
});

test('Lia retains its old subset when a real target update is canceled, and never adds a new reveal automatically', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'conditional-lia-public');
  try {
    const views = await observe(table); const entry = entries['conditional-lia-public']; const choice = panel(table, entry);
    await activate(table, views, entry); await passUntil(table, views, game => !game.activeWindow, 500);
    await click(table, views, table.pages[2]!.getByRole('button', { name: '正体を公開', exact: true }));
    await passUntil(table, views, game => !game.activeWindow, 500);
    await expect(choice).toContainText('現在の選択：楓'); await expect(choice.getByRole('checkbox', { name: '凛', exact: true })).not.toBeChecked();
    await click(table, views, table.pages[0]!.getByRole('button', { name: '行動を終える', exact: true }));
    await choice.getByRole('checkbox', { name: '楓', exact: true }).uncheck(); await choice.getByRole('checkbox', { name: '凛', exact: true }).check();
    await click(table, views, choice.getByRole('button', { name: '対象の変更を宣言', exact: true }));
    await passUntil(table, views, game => game.activeWindow?.pendingActorId === table.sessions[3]!.id, 500);
    await table.pages[3]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await click(table, views, table.pages[3]!.getByRole('button', { name: '割り込みを使う', exact: true }));
    await passUntil(table, views, game => !game.activeWindow, 500);
    await table.pages[0]!.reload(); await expect(choice).toContainText('現在の選択：楓');
    expect(setting(table, views, entry).selectedTargetIds).toEqual([table.sessions[1]!.id]);
  } finally { await table.close(); }
});

test('forged hidden Lia target is rejected over WebSocket without a state change or private identity disclosure', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'conditional-lia-public');
  try {
    const views = await observe(table); const entry = entries['conditional-lia-public'];
    await expect(panel(table, entry).getByRole('checkbox', { name: '凛', exact: true })).toHaveCount(0);
    const targetId = table.sessions[2]!.id;
    const before = await (await request.get(`/__test/rooms/${table.roomId}/game`)).json();
    const result = await table.pages[0]!.evaluate(async ({ roomId, abilityId, targetEventId, targetId }) => {
      const url = new URL(`/api/rooms/${roomId}/ws`, location.origin); url.protocol = 'ws:';
      return new Promise<{ error: unknown; before: any; after: any }>((resolve, reject) => {
        const socket = new WebSocket(url); let first: any; let error: unknown;
        const timer = setTimeout(() => { socket.close(); reject(Error('CONDITIONAL_FORGERY_TIMEOUT')); }, 10000);
        socket.addEventListener('message', event => {
          const message = JSON.parse(String(event.data));
          if (message.type === 'snapshot' && !first && message.view.readOnly === false) {
            first = message; socket.send(JSON.stringify({ protocolVersion: 1, commandId: 'forged-hidden-lia', expectedRevision: message.revision,
              command: { type: 'SET_CONDITIONAL_ABILITY', abilityId, targetEventId, enabled: true, targetIds: [targetId] } }));
          } else if (message.type === 'error') error = message;
          else if (error && message.type === 'snapshot') { clearTimeout(timer); socket.close(); resolve({ error, before: first, after: message }); }
        });
      });
    }, { roomId: table.roomId, abilityId: entry.id, targetEventId: setting(table, views, entry).targetEventId, targetId });
    expect(result.error).toMatchObject({ type: 'error', code: 'INVALID_ACTION' });
    expect(result.after.revision).toBe(result.before.revision);
    expect(result.after.view.game).toEqual(result.before.view.game);
    expect(JSON.stringify(result)).not.toContain(before.players[targetId].characterId);
    expect(await (await request.get(`/__test/rooms/${table.roomId}/game`)).json()).toEqual(before);
    await expect(table.pages[0]!.locator('body')).not.toContainText(before.players[targetId].characterId);
  } finally { await table.close(); }
});

test('Truth follower preview displays each public target value and the selected attack uses those numbers', async ({ browser, request }, testInfo) => {
  const table = await tableFixture(browser, request, 'conditional-asfelt-truth');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id;
    await activate(table, views, entries['conditional-asfelt-truth']); await passUntil(table, views, game => !game.activeWindow, 500);
    const option = views.get(a)!.game!.followerAttackOptions.find(option => option.cardInstanceId === 'a2-p22-r3c1' && option.dedicated)!;
    expect(option.targetValues).toHaveLength(3);
    const attack = table.pages[0]!.getByRole('region', { name: '従者による攻撃' });
    await attack.getByRole('combobox', { name: '攻撃に使う従者', exact: true }).selectOption('a2-p22-r3c1');
    for (const value of option.targetValues!) {
      const name = table.sessions.find(session => session.id === value.actorId)!.name;
      await expect(attack).toContainText(`${name}：効果Lv ${value.effectLevel}・ダメージ ${value.damage}`);
      await expect(attack).not.toContainText(value.actorId);
    }
    const target = option.targetValues!.find(value => value.actorId === table.sessions[2]!.id)!;
    await attack.getByLabel('専用の攻撃として使う').check();
    const screenshot = testInfo.outputPath('truth-follower-target-values.png');
    await attack.screenshot({ path: screenshot });
    await testInfo.attach('Truth follower target values', { path: screenshot, contentType: 'image/png' });
    await click(table, views, attack.getByRole('button', { name: '従者で攻撃する', exact: true }));
    const defense = await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense' && game.currentAttack?.targetId === table.sessions[2]!.id, 500);
    expect(defense.currentAttack!.technique).toMatchObject({ effectLevel: target.effectLevel, damage: target.damage });
  } finally { await table.close(); }
});

test('Upa bundle displays the elected warrior increment and resolves both actual paid sources', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'conditional-upa-attack');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id;
    await activate(table, views, entries['conditional-upa-attack']); await passUntil(table, views, game => !game.activeWindow, 500);
    const bundle = table.pages[0]!.getByRole('region', { name: '複数従者の攻撃' });
    await bundle.getByRole('combobox', { name: '使う能力', exact: true }).selectOption('c2-p05-r1c2-ab02');
    for (const id of ['a2-p20-r3c1', 'a2-p22-r2c2']) {
      await bundle.getByRole('combobox', { name: '追加する従者', exact: true }).selectOption(id);
      await bundle.getByRole('button', { name: '攻撃に加える', exact: true }).click();
    }
    const griffin = bundle.getByRole('group', { name: 'グリフォン（配置中）', exact: true });
    await expect(griffin).toContainText('ダメージ 9'); await griffin.getByRole('radio', { name: '楓', exact: true }).check();
    await click(table, views, bundle.getByRole('button', { name: '選んだ従者で攻撃する', exact: true }));
    await table.pages[0]!.reload(); await expect(table.pages[0]!.getByRole('region', { name: '同時に使っている従者' })).toContainText('グリフォン');
    const defense = await passUntil(table, views, game => game.activeWindow?.kind === 'normal-defense', 500);
    expect(defense.currentAttack!.technique.damage).toBe(9);
    const done = await passUntil(table, views, game => !game.activeWindow, 500);
    expect((await storedDiscard())).toEqual(expect.arrayContaining(['a2-p20-r3c1', 'a2-p22-r2c2']));
    expect(views.get(a)!.game!.self.followers).toEqual([]);
  } finally { await table.close(); }
});

test('Dia OFF preserves excess cards through reload and requires the actual two-card END selection', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'conditional-dia-public');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id; const entry = entries['conditional-dia-public']; const page = table.pages[0]!;
    await activate(table, views, entry); await passUntil(table, views, game => !game.activeWindow, 500);
    await click(table, views, page.getByRole('button', { name: '行動を終える', exact: true }));
    await click(table, views, panel(table, entry).getByRole('button', { name: '使用しない設定に戻す', exact: true }));
    await page.reload(); await expect(page.getByRole('button', { name: '選んだ2枚を捨てて手番を終える', exact: true })).toBeDisabled();
    expect(views.get(a)!.game!.self.hand).toHaveLength(8);
    const hand = page.getByRole('region', { name: '自分の手札' });
    const beforeHand = [...views.get(a)!.game!.self.hand];
    const discardedIds = beforeHand.slice(0, 2);
    for (const id of discardedIds) {
      const card = hand.locator('button.card-face').nth(beforeHand.indexOf(id));
      await card.click(); await expect(card).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(hand.locator('button.card-face[aria-pressed="true"]')).toHaveCount(2);
    await click(table, views, page.getByRole('button', { name: '選んだ2枚を捨てて手番を終える', exact: true }));
    await passUntil(table, views, game => !game.activeWindow, 500);
    expect(views.get(a)!.game!.self.hand).toHaveLength(6);
    for (const id of discardedIds) {
      expect(views.get(a)!.game!.self.hand).not.toContain(id);
      expect((await storedDiscard()).filter(card => card === id)).toHaveLength(1);
    }
  } finally { await table.close(); }
});
