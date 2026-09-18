import { expect, test } from '@playwright/test';
import { getAction, getCharacter } from '../../packages/catalog/src/index.js';
import { observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
function game(table: Table, views: Views, seat = 0) { return views.get(table.sessions[seat]!.id)!.game!; }
async function click(table: Table, views: Views, seat: number, name: string) {
  const owner = table.sessions[0]!.id; const revision = views.get(owner)!.revision;
  await table.pages[seat]!.getByRole('button', { name, exact: true }).click();
  await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
}
async function reload(table: Table, views: Views, seat = 0) {
  const before = structuredClone(game(table, views, seat));
  await table.pages[seat]!.reload();
  await expect(table.pages[seat]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
  expect(game(table, views, seat)).toEqual(before);
}
async function use(table: Table, views: Views, name: string, targetSeat?: number) {
  const page = table.pages[0]!;
  const panel = page.locator('.panel').filter({ has: page.getByRole('heading', { name, exact: true }) });
  if (targetSeat !== undefined) {
    await expect(panel.getByRole('button', { name: `${name}を使う`, exact: true })).toBeDisabled();
    await panel.getByRole('combobox', { name: '能力の対象', exact: true }).selectOption(table.sessions[targetSeat]!.id);
  }
  await click(table, views, 0, `${name}を使う`);
}
async function cancel(table: Table, views: Views) {
  await passUntil(table, views, state => state.activeWindow?.pendingActorId === table.sessions[3]!.id, 500);
  const panel = table.pages[3]!.getByRole('complementary', { name: '現在の判断' });
  await panel.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption('cancel-ability');
  await panel.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
  await click(table, views, 3, '割り込みを使う');
}
const inspections = [
  { scenario: 'info-cham-followers', name: '見ちゃった', zone: 'followers' },
  { scenario: 'info-lia-chants', name: '神出鬼没', zone: 'chants' },
  { scenario: 'info-lester-rumor', name: '噂', zone: 'character' },
  { scenario: 'info-alseil-hand', name: '占星', zone: 'hand' },
] as const;
for (const entry of inspections) test(`${entry.scenario} shows only the owner the exact original information and restores it on reload`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table); const targetId = table.sessions[1]!.id;
    const target = structuredClone(table.expected!.players[targetId]!);
    await use(table, views, entry.name, 1);
    await passUntil(table, views, state => state.activeWindow?.kind === 'private-inspection', 500);
    const decision = structuredClone(game(table, views).inspection!);
    expect(decision).toMatchObject({ targetId, zone: entry.zone });
    const panel = table.pages[0]!.getByRole('complementary', { name: '自分だけの確認内容' });
    await expect(panel).toContainText('あなただけに表示');
    if (entry.zone === 'character') {
      expect(decision.characterId).toBe(target.characterId);
      await expect(panel).toContainText(getCharacter(target.characterId)!.name);
    } else {
      const ids = entry.zone === 'hand' ? target.hand : target[entry.zone].map(card => card.cardInstanceId);
      expect(decision.cards.map(card => card.cardInstanceId)).toEqual(ids);
      for (const id of ids) await expect(panel).toContainText(getAction(id)!.name);
      for (const seat of [2, 3]) for (const id of ids) expect(JSON.stringify(game(table, views, seat))).not.toContain(id);
    }
    for (const seat of [1, 2, 3]) {
      expect(game(table, views, seat).inspection).toBeNull();
      await expect(table.pages[seat]!.getByRole('complementary', { name: '自分だけの確認内容' })).toHaveCount(0);
      await expect(table.pages[seat]!.getByRole('complementary', { name: '情報確認の判断' })).toContainText('確認を待っています');
    }
    await reload(table, views); expect(game(table, views).inspection).toEqual(decision);
    await click(table, views, 0, '確認を終える');
    await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views).inspection).toBeNull(); expect(game(table, views).phase).toBe('action');
    const stored = await (await request.get(`/__test/rooms/${table.roomId}/game`)).json();
    expect(stored.players[targetId]).toEqual(target);
  } finally { await table.close(); }
});
for (const entry of [
  { scenario: 'info-lia-chants', name: '神出鬼没', all: true },
  { scenario: 'info-alseil-hand', name: '占星', all: false },
] as const) test(`${entry.scenario} requires an explicit saved discard choice and publishes only the discarded cards`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table); await use(table, views, entry.name, 1);
    await passUntil(table, views, state => state.activeWindow?.kind === 'private-inspection', 500);
    const decision = game(table, views).inspection!;
    const panel = table.pages[0]!.getByRole('complementary', { name: '自分だけの確認内容' });
    if (!entry.all) {
      await expect(panel.getByRole('button', { name: '選んだ1枚を捨てさせる', exact: true })).toBeDisabled();
      await panel.getByRole('radio').first().check();
    } else { expect(decision.cards).toHaveLength(2); await expect(panel.getByRole('radio')).toHaveCount(0); }
    await click(table, views, 0, entry.all ? '見た詠唱札をすべて捨てさせる' : '選んだ1枚を捨てさせる');
    await passUntil(table, views, state => !state.activeWindow, 500);
    const discarded = entry.all ? decision.cards : decision.cards.slice(0, 1);
    for (const seat of [0, 1, 2, 3]) for (const card of discarded) expect((await storedDiscard()).filter(id => id === card.cardInstanceId)).toHaveLength(1);
    await reload(table, views); expect(game(table, views).inspection).toBeNull();
  } finally { await table.close(); }
});
for (const scenario of ['info-aiel-twins', 'info-flaiard-twins'] as const) test(`${scenario} swaps unequal whole hands through the explicit public target control`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, scenario);
  try {
    const views = await observe(table); const a = [...game(table, views).self.hand]; const b = [...game(table, views, 1).self.hand];
    expect(a.length).not.toBe(b.length);
    await expect(table.pages[0]!.getByRole('region', { name: '使える特殊能力' })).toContainText('通常の行動を使います');
    await use(table, views, '双子', 1); await reload(table, views);
    await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views).self.hand).toEqual(b); expect(game(table, views, 1).self.hand).toEqual(a);
    expect(game(table, views).phase).toBe('hand-adjustment');
    for (const seat of [2, 3]) for (const card of [...a, ...b]) expect(JSON.stringify(game(table, views, seat))).not.toContain(card);
  } finally { await table.close(); }
});
test('hidden twin stays ineligible and a forged current-context target is atomically rejected', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'info-twins-hidden');
  try {
    const views = await observe(table); const ownerId = table.sessions[0]!.id; const targetId = table.sessions[1]!.id;
    const abilityId = 'c2-p04-r1c1-ab04'; const targetCharacterId = table.expected!.players[targetId]!.characterId;
    expect(getCharacter(targetCharacterId)!.name).toBe('爆炎のフレイアード');
    const assertHidden = async () => {
      const own = game(table, views); const publicTarget = own.players[targetId]!;
      expect(publicTarget).toMatchObject({ id: targetId, revealed: false });
      expect(publicTarget.characterId).toBeUndefined();
      expect(own.abilityOptions.find(option => option.abilityId === abilityId)).toBeUndefined();
      const page = table.pages[0]!;
      const target = page.getByRole('region', { name: '参加者の公開状態' }).getByRole('article')
        .filter({ has: page.getByRole('heading', { name: table.sessions[1]!.name, exact: true }) });
      await expect(target).toContainText('正体非公開');
      await expect(target.getByRole('button', { name: '爆炎のフレイアードの人物カードを見る', exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: '双子', exact: true })).toHaveCount(0);
      await expect(page.getByRole('combobox', { name: '能力の対象', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '双子を使う', exact: true })).toHaveCount(0);
    };
    await assertHidden(); await reload(table, views); await assertHidden();

    const storedBefore = await (await request.get(`/__test/rooms/${table.roomId}/game`)).json();
    const commandId = `forged-hidden-twin-${crypto.randomUUID()}`;
    const targetEventId = `turn-${table.expected!.turnNumber ?? 0}-${ownerId}-${game(table, views).phase}`;
    const forged = await table.pages[0]!.evaluate(async ({ roomId, commandId, abilityId, targetEventId, targetId }) => {
      const url = new URL(`/api/rooms/${encodeURIComponent(roomId)}/ws`, location.origin); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return new Promise<{ sent: Record<string, unknown>; rejection: Record<string, unknown>; before: Record<string, any>; after: Record<string, any> }>((resolve, reject) => {
        const socket = new WebSocket(url); let before: Record<string, any> | null = null; let rejection: Record<string, unknown> | null = null;
        let sent: Record<string, unknown> | null = null;
        const timer = setTimeout(() => { socket.close(); reject(new Error('FORGED_HIDDEN_TWIN_TIMEOUT')); }, 10_000);
        socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('FORGED_HIDDEN_TWIN_SOCKET')); });
        socket.addEventListener('message', event => {
          const message = JSON.parse(String(event.data)) as Record<string, any>;
          if (message.type === 'snapshot' && !before && message.view?.readOnly === false) {
            before = message;
            sent = { protocolVersion: 1, commandId, expectedRevision: message.revision,
              command: { type: 'USE_ABILITY', abilityId, targetEventId, targetId } };
            socket.send(JSON.stringify(sent));
          } else if (before && message.type === 'error') rejection = message;
          else if (before && sent && rejection && message.type === 'snapshot') {
            clearTimeout(timer); socket.close();
            resolve({ sent, rejection, before, after: message });
          }
        });
      });
    }, { roomId: table.roomId, commandId, abilityId, targetEventId, targetId });
    expect(forged.sent).toMatchObject({ protocolVersion: 1, commandId, expectedRevision: forged.before.revision,
      command: { type: 'USE_ABILITY', abilityId, targetEventId, targetId } });
    expect(forged.before.view.game).toMatchObject({ activeWindow: null, phase: 'action' });
    expect(forged.before.view.game.players[targetId]).toMatchObject({ id: targetId, revealed: false });
    expect(forged.before.view.game.players[targetId]).not.toHaveProperty('characterId');
    expect(forged.before.view.game.abilityOptions.find((option: { abilityId: string }) => option.abilityId === abilityId)).toBeUndefined();
    expect(forged.rejection).toEqual({ type: 'error', commandId, code: 'INVALID_ACTION' });
    expect(forged.after.revision).toBe(forged.before.revision);
    expect(forged.after.view.game.self.hand).toEqual(forged.before.view.game.self.hand);
    expect(forged.after.view.game.players[targetId]).toEqual(forged.before.view.game.players[targetId]);
    const storedAfter = await (await request.get(`/__test/rooms/${table.roomId}/game`)).json();
    expect(storedAfter.players[ownerId].hand).toEqual(storedBefore.players[ownerId].hand);
    expect(storedAfter.players[targetId].hand).toEqual(storedBefore.players[targetId].hand);
  } finally { await table.close(); }
});
test('Lancaster discards actual printed magic while retaining a follower and warrior technique', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'info-lancaster-discard');
  try {
    const views = await observe(table); const before = [...game(table, views).self.hand];
    const magic = before.filter(id => ['白光', '魔詩'].includes(getAction(id)!.name));
    expect(magic).toHaveLength(2); await use(table, views, 'わかんねえよ');
    await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views).self.hand).toEqual(before.filter(id => !magic.includes(id)));
    expect(game(table, views).phase).toBe('hand-adjustment');
    for (const card of magic) expect((await storedDiscard()).filter(id => id === card)).toHaveLength(1);
  } finally { await table.close(); }
});
test('Shadow conceals its actual public owner without spending the main action', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'info-alseil-shadow');
  try {
    const views = await observe(table); expect(game(table, views).players[table.sessions[0]!.id]!.revealed).toBe(true);
    await use(table, views, '影'); await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views).players[table.sessions[0]!.id]!.revealed).toBe(false); expect(game(table, views).phase).toBe('action');
    await reload(table, views); await expect(table.pages[0]!.getByRole('button', { name: '影を使う', exact: true })).toHaveCount(0);
  } finally { await table.close(); }
});
test('Uonos forced reveal publishes Alseil without its voluntary spirit benefit', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'info-uonos-reveal');
  try {
    const views = await observe(table); const spirit = game(table, views, 1).self.stats.spirit;
    await use(table, views, '策謀の主', 1); await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views, 1).players[table.sessions[1]!.id]!.revealed).toBe(true);
    expect(game(table, views, 1).spiritExpiry).toBeNull(); expect(game(table, views, 1).self.stats.spirit).toBe(spirit);
    for (const seat of [0, 2, 3]) expect(game(table, views, seat).players[table.sessions[1]!.id]!.characterId).toBe('c2-p04-r2c1');
  } finally { await table.close(); }
});
for (const entry of [
  { scenario: 'info-cham-draw', name: 'なになに' },
  { scenario: 'info-lancelot-growth', name: '成長' },
] as const) for (const canceled of [false, true]) test(`${entry.scenario} selected draw canceled=${canceled} survives reload and draws the exact count`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table); const before = game(table, views).self.hand.length;
    const choice = table.pages[0]!.getByRole('checkbox', { name: `${entry.name}：1枚の代わりに2枚補充する`, exact: true });
    await expect(choice).not.toBeChecked(); await choice.check(); await click(table, views, 0, 'カードを引く');
    await reload(table, views); if (canceled) await cancel(table, views);
    await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views).self.hand).toHaveLength(before + (canceled ? 1 : 2));
    expect(game(table, views).phase).toBe('action'); await expect(choice).toHaveCount(0);
  } finally { await table.close(); }
});
for (const entry of [
  { scenario: 'info-alseil-truepower', seat: 0 },
  { scenario: 'info-alseil-reveal-setup', seat: 0 },
  { scenario: 'info-alseil-reveal-attack', seat: 1 },
  { scenario: 'info-alseil-reveal-otherturn', seat: 1 },
] as const) test(`${entry.scenario} voluntary base12 displays its saved actor END and survives reload`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table); const before = game(table, views, entry.seat).self.stats.spirit;
    const choice = table.pages[entry.seat]!.getByRole('checkbox', { name: '本当の力：基礎精神力を12にする', exact: true });
    await expect(choice).not.toBeChecked(); await choice.check(); await click(table, views, entry.seat, '正体を公開');
    await passUntil(table, views, () => !!game(table, views, entry.seat).spiritExpiry, 500);
    expect(game(table, views, entry.seat).self.stats.spirit).toBe(before + 6);
    expect(game(table, views, entry.seat).spiritExpiry).toMatchObject({ expiresOnActorId: table.sessions[0]!.id, timing: 'turn-end', active: true });
    await expect(table.pages[entry.seat]!.getByText('本当の力：葵さんの手番終了まで。', { exact: false })).toBeVisible();
    await reload(table, views, entry.seat);
    for (let seat = 0; seat < 4; seat++) if (seat !== entry.seat) expect(game(table, views, seat).spiritExpiry).toBeNull();
    if (entry.scenario === 'info-alseil-truepower') {
      await passUntil(table, views, state => !state.activeWindow, 500);
      await click(table, views, 0, '行動を終える');
      await click(table, views, 0, '選んだ0枚を捨てて手番を終える');
      expect(game(table, views).spiritExpiry).toBeNull(); expect(game(table, views).self.stats.spirit).toBe(before);
      await reload(table, views);
    }
  } finally { await table.close(); }
});
test('canceling voluntary TruePower leaves its identity public and its ordinary spirit unchanged', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'info-alseil-truepower');
  try {
    const views = await observe(table); const before = game(table, views).self.stats.spirit;
    await table.pages[0]!.getByRole('checkbox', { name: '本当の力：基礎精神力を12にする', exact: true }).check();
    await click(table, views, 0, '正体を公開'); await cancel(table, views);
    await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views).players[table.sessions[0]!.id]!.revealed).toBe(true); expect(game(table, views).self.stats.spirit).toBe(before);
    expect(game(table, views).spiritExpiry).toBeNull();
  } finally { await table.close(); }
});
for (const entry of [
  { scenario: 'info-alseil-hand', name: '占星', target: 1, main: false },
  { scenario: 'info-aiel-twins', name: '双子', target: 1, main: true },
] as const) test(`${entry.scenario} canceled use retains both hands and never opens a private result`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table); const before = [game(table, views).self.hand, game(table, views, 1).self.hand];
    await use(table, views, entry.name, entry.target); await cancel(table, views);
    await passUntil(table, views, state => !state.activeWindow, 500);
    expect([game(table, views).self.hand, game(table, views, 1).self.hand]).toEqual(before);
    expect(game(table, views).inspection).toBeNull(); expect(game(table, views).phase).toBe(entry.main ? 'hand-adjustment' : 'action');
    await expect(table.pages[0]!.getByRole('button', { name: `${entry.name}を使う`, exact: true })).toHaveCount(0);
  } finally { await table.close(); }
});
test('inspection during an own attack resumes that exact attack after a private decision', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'info-alseil-attack');
  try {
    const views = await observe(table);
    await passUntil(table, views, state => !!state.currentAttack && state.activeWindow?.pendingActorId === table.sessions[0]!.id, 500);
    const source = game(table, views).currentAttack!.actionId;
    await use(table, views, '占星', 1); await passUntil(table, views, state => state.activeWindow?.kind === 'private-inspection', 500);
    await reload(table, views); await click(table, views, 0, '確認を終える');
    expect(game(table, views).currentAttack!.actionId).toBe(source);
    await passUntil(table, views, state => !state.activeWindow, 500); expect(game(table, views).phase).toBe('withdrawal');
  } finally { await table.close(); }
});
test('ordinary reveal can pause a private inspection for TruePower and restore its exact saved cards', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'info-alseil-hand', 4, { viewport: { width: 390, height: 844 } });
  try {
    const views = await observe(table); await use(table, views, '占星', 1);
    await passUntil(table, views, state => state.activeWindow?.kind === 'private-inspection', 500);
    const decision = structuredClone(game(table, views).inspection!);
    const panel = table.pages[0]!.getByRole('complementary', { name: '自分だけの確認内容' });
    await panel.getByRole('radio').first().check();
    await table.pages[0]!.getByRole('checkbox', { name: '本当の力：基礎精神力を12にする', exact: true }).check();
    await click(table, views, 0, '正体を公開');
    expect(game(table, views).inspection).toEqual(decision);
    await expect(panel).toContainText('割り込みの解決を待っています');
    await expect(panel.getByRole('button', { name: '選んだ1枚を捨てさせる', exact: true })).toBeDisabled();
    await reload(table, views);
    await passUntil(table, views, state => state.activeWindow?.kind === 'private-inspection', 500);
    expect(game(table, views).inspection).toEqual(decision);
    await expect(panel.getByRole('radio').first()).not.toBeChecked();
    await expect(panel.getByRole('button', { name: '選んだ1枚を捨てさせる', exact: true })).toBeDisabled();
    await click(table, views, 0, '確認を終える');
    await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views).spiritExpiry).toMatchObject({ active: true });
    expect(game(table, views, 1).self.hand).toEqual(table.expected!.players[table.sessions[1]!.id]!.hand);
  } finally { await table.close(); }
});
test('Uonos forces Lia public and preserves the other player’s real transformation control', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'info-uonos-lia');
  try {
    const views = await observe(table); await use(table, views, '策謀の主', 1);
    await passUntil(table, views, () => game(table, views, 2).lifecycleAbilities.includes('lancelot-transform'), 500);
    await click(table, views, 2, 'ランスロットⅡへ変身する');
    await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views, 2).self.characterId).toBe('c2-p07-r1c1');
    await reload(table, views, 2);
  } finally { await table.close(); }
});

test('G09 ordinary reveal leaves TruePower unchecked and inactive after reload', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'info-alseil-truepower');
  try {
    const views = await observe(table), owner = table.sessions[0]!.id;
    const base = game(table, views).self.stats.spirit;
    const choice = table.pages[0]!.getByRole('checkbox', { name: '本当の力：基礎精神力を12にする', exact: true });
    await expect(choice).not.toBeChecked();
    for (let seat = 1; seat < 4; seat++) {
      expect(JSON.stringify(game(table, views, seat))).not.toContain('c2-p04-r2c1');
      await expect(table.pages[seat]!.getByRole('checkbox', { name: '本当の力：基礎精神力を12にする', exact: true })).toHaveCount(0);
    }
    await reload(table, views);
    await expect(choice).not.toBeChecked();
    await click(table, views, 0, '正体を公開');
    await passUntil(table, views, state => !state.activeWindow, 500);
    await reload(table, views);
    await reload(table, views, 1);
    for (let seat = 0; seat < 4; seat++) {
      expect(game(table, views, seat).players[owner]!.characterId).toBe('c2-p04-r2c1');
      expect(game(table, views, seat).revealAbilityOptions).toEqual([]);
    }
    expect(game(table, views).self.stats.spirit).toBe(base);
    expect(game(table, views).spiritExpiry).toBeNull();
    await expect(choice).toHaveCount(0);
  } finally { await table.close(); }
});

async function ordinaryOptionalDraw(browser: Parameters<typeof tableFixture>[0], request: Parameters<typeof tableFixture>[1], scenario: 'info-cham-draw' | 'info-lancelot-growth', name: string) {
  const table = await tableFixture(browser, request, scenario);
  try {
    const views = await observe(table), before = game(table, views).self.hand.length;
    const label = `${name}：1枚の代わりに2枚補充する`;
    const choice = table.pages[0]!.getByRole('checkbox', { name: label, exact: true });
    await expect(choice).not.toBeChecked();
    for (let seat = 1; seat < 4; seat++) {
      expect(game(table, views, seat).drawAbilityOptions).toEqual([]);
      await expect(table.pages[seat]!.getByRole('checkbox', { name: label, exact: true })).toHaveCount(0);
      if (scenario === 'info-cham-draw') expect(JSON.stringify(game(table, views, seat))).not.toContain('c2-p01-r2c2');
    }
    await reload(table, views);
    await expect(choice).not.toBeChecked();
    await click(table, views, 0, 'カードを引く');
    await passUntil(table, views, state => !state.activeWindow, 500);
    expect(game(table, views).self.hand).toHaveLength(before + 1);
    expect(game(table, views).phase).toBe('action');
    await reload(table, views);
    await reload(table, views, 1);
    await expect(choice).toHaveCount(0);
    if (scenario === 'info-cham-draw') for (let seat = 1; seat < 4; seat++) expect(JSON.stringify(game(table, views, seat))).not.toContain('c2-p01-r2c2');
  } finally { await table.close(); }
}
test('G09 Cham ordinary draw leaves optional replacement unused and concealed after reload', async ({ browser, request }) => {
  await ordinaryOptionalDraw(browser, request, 'info-cham-draw', 'なになに');
});
test('G09 transformed Lancelot ordinary draw leaves Growth unused after reload', async ({ browser, request }) => {
  await ordinaryOptionalDraw(browser, request, 'info-lancelot-growth', '成長');
});

async function declineInformation(browser: Parameters<typeof tableFixture>[0], request: Parameters<typeof tableFixture>[1], scenario: Parameters<typeof tableFixture>[2], abilityId: string) {
  const table = await tableFixture(browser, request, scenario);
  try {
    const views = await observe(table), owner = table.sessions[0]!.id;
    const before = structuredClone(game(table, views));
    expect(before.abilityOptions.some(option => option.abilityId === abilityId)).toBe(true);
    function privacy() {
      for (let seat = 1; seat < 4; seat++) {
        const view = game(table, views, seat);
        expect(view.abilityOptions.some(option => option.abilityId === abilityId)).toBe(false);
        expect(view.inspection).toBeNull();
        if (!before.players[owner]!.revealed) expect(view.players[owner]).not.toHaveProperty('characterId');
      }
    }
    privacy();
    await reload(table, views);
    await click(table, views, 0, '行動を終える');
    await reload(table, views);
    privacy();
    const own = game(table, views).self;
    const excess = Math.max(0, own.hand.length - own.stats.handLimit);
    for (let index = 0; index < excess; index++) await table.pages[0]!.getByRole('region', { name: '自分の手札', exact: true }).getByRole('article').nth(index).getByRole('button').first().click();
    await click(table, views, 0, `選んだ${excess}枚を捨てて手番を終える`);
    await reload(table, views);
    await reload(table, views, 1);
    const done = game(table, views);
    expect(done.phase).toBe('turn-start');
    expect(done.turnSeat).toBe(1);
    expect(done.self.hand).toEqual(before.self.hand.slice(excess));
    expect(done.players).toEqual({ ...before.players, [owner]: { ...before.players[owner], handCount: before.players[owner]!.handCount - excess } });
    expect(done.inspection).toBeNull();
    privacy();
  } finally { await table.close(); }
}

test('G09 decline information info-cham-followers survives end-turn reload', async ({ browser, request }) => {
  await declineInformation(browser, request, 'info-cham-followers', 'c2-p01-r2c2-ab03');
});

test('G09 decline information info-lia-chants survives end-turn reload', async ({ browser, request }) => {
  await declineInformation(browser, request, 'info-lia-chants', 'c2-p03-r1c2-ab02');
});

test('G09 decline information info-lester-rumor survives end-turn reload', async ({ browser, request }) => {
  await declineInformation(browser, request, 'info-lester-rumor', 'c2-p03-r2c1-ab03');
});

test('G09 decline information info-alseil-hand survives end-turn reload', async ({ browser, request }) => {
  await declineInformation(browser, request, 'info-alseil-hand', 'c2-p04-r2c1-ab02');
});

test('G09 decline information info-lancaster-discard survives end-turn reload', async ({ browser, request }) => {
  await declineInformation(browser, request, 'info-lancaster-discard', 'c2-p02-r2c1-ab04');
});

test('G09 decline information info-aiel-twins survives end-turn reload', async ({ browser, request }) => {
  await declineInformation(browser, request, 'info-aiel-twins', 'c2-p04-r1c1-ab04');
});

test('G09 decline information info-flaiard-twins survives end-turn reload', async ({ browser, request }) => {
  await declineInformation(browser, request, 'info-flaiard-twins', 'c2-p06-r2c1-ab04');
});

test('G09 decline information info-alseil-shadow survives end-turn reload', async ({ browser, request }) => {
  await declineInformation(browser, request, 'info-alseil-shadow', 'c2-p04-r2c1-ab01');
});

test('G09 decline information info-uonos-reveal survives end-turn reload', async ({ browser, request }) => {
  await declineInformation(browser, request, 'info-uonos-reveal', 'c2-p05-r1c1-ab01');
});
