import { test, expect, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { tableFixture, windowPassButtonName } from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
async function watch(table: Table) {
  const views = new Map<string, RoomView>();
  for (const [index, page] of table.pages.entries()) {
    page.on('websocket', socket => socket.on('framereceived', frame => {
      const message = JSON.parse(String(frame.payload));
      if (message.type === 'snapshot') views.set(table.sessions[index]!.id, message.view);
    }));
    await page.goto(table.url);
    await expect(page.getByRole('region', { name: '自分の手札' })).toBeVisible();
  }
  return views;
}

/** Real UI clicks and server broadcasts; measures automation overhead, never human decision time. */
async function passToWithdrawal(table: Table, views: Map<string, RoomView>, info: TestInfo) {
  const owner = table.sessions[0]!.id; const started = Date.now();
  const windows = new Set<string>(); const decisions: { kind: string; elapsedMs: number }[] = [];
  for (let step = 0; step < 160; step++) {
    const view = views.get(owner)!; const game = view.game!;
    if (game.phase === 'withdrawal' && !game.activeWindow) {
      const path = info.outputPath('automated-combat-metrics.json');
      await writeFile(path, JSON.stringify({
        method: 'Automated Chromium inputs against local workerd; no human participants', seats: table.pages.length,
        windows: windows.size, passCount: decisions.length, elapsedMs: Date.now() - started, decisions,
      }, null, 2));
      await info.attach('automated-combat-metrics.json', { contentType: 'application/json', path });
      return game;
    }
    expect(game.activeWindow, `active decision at step ${step}`).not.toBeNull();
    const window = game.activeWindow!; windows.add(window.windowId);
    const index = table.sessions.findIndex(session => session.id === window.pendingActorId);
    const page = table.pages[index]!; const before = view.revision; const decisionStart = Date.now();
    await page.getByRole('button', { name: windowPassButtonName }).click();
    await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(before);
    decisions.push({ kind: window.kind, elapsedMs: Date.now() - decisionStart });
  }
  throw Error('Combat did not finish within the bounded number of real UI inputs');
}

test('eight browsers select a target by keyboard and resolve one complete normal attack', async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const table = await tableFixture(browser, request, 'combat-ready', 8);
  try {
    const views = await watch(table); const attacker = table.pages[0]!;
    await attacker.getByRole('region', { name: '自分の手札' }).getByRole('button', { name: '踏み込み／弓', exact: true }).click();
    const target = attacker.getByRole('article').filter({ has: attacker.getByRole('heading', { name: '楓', exact: true }) }).getByRole('checkbox');
    await target.focus(); await attacker.keyboard.press('Space'); await expect(target).toBeChecked();
    await attacker.getByRole('button', { name: '攻撃を確認して実行', exact: true }).click();
    await expect.poll(() => views.get(table.sessions[0]!.id)?.game?.activeWindow?.kind).toBe('declaration');
    for(const page of table.pages)await page.reload();
    const result = await passToWithdrawal(table, views, info);
    expect(result.players[table.sessions[1]!.id]!.damage).toBe(4);
    await expect(attacker.getByRole('button', { name: '離脱しない', exact: true })).toBeEnabled();
  } finally { await table.close(); }
});

test('six browsers resolve a third-party cancellation and its immediate OPEN refill', async ({ browser, request }, info) => {
  const table = await tableFixture(browser, request, 'third-party-interrupt', 6);
  try {
    const third = table.pages[2]!;
    let hold = false; const held: (() => void)[] = [];
    await third.routeWebSocket('**/api/rooms/*/ws', route => {
      const server = route.connectToServer();
      server.onMessage(message => { if (hold) held.push(() => route.send(message)); else route.send(message); });
    });
    const views = await watch(table);
    const hand = third.getByRole('region', { name: '自分の手札' });
    // An unaffected detail button remains focusable after the hand changes and the child window opens.
    const retainedCard = table.expected!.players[table.sessions[2]!.id]!.hand.find(id => id !== 'a2-p02-r2c3')!;
    const retained = hand.locator(`article:has(img[src$="/${retainedCard}.webp"])`).getByRole('button', { name: /の詳細を見る/ });
    await third.getByRole('combobox', { name: /使うカード/ }).selectOption('a2-p02-r2c3');
    hold = true;
    await third.getByRole('button', { name: '割り込みを使う', exact: true }).click();
    await expect.poll(() => held.length).toBeGreaterThan(0);
    await retained.focus();
    hold = false; for (const forward of held.splice(0)) forward();
    await expect.poll(() => views.get(table.sessions[2]!.id)?.game?.self.hand.includes('a2-p02-r2c3')).toBe(false);
    await expect(retained).toBeFocused();
    for(const page of table.pages)await page.reload();
    const result = await passToWithdrawal(table, views, info);
    expect(result.players[table.sessions[1]!.id]!.damage).toBe(0);
    expect(result.players[table.sessions[2]!.id]!.open).toContain('a2-p01-r2c1');
    const observer = table.pages[0]!;
    await observer.getByRole('region', { name: '参加者の公開状態' }).getByRole('button', { name: '祝福の詳細を見る', exact: true }).click();
    await expect(observer.getByRole('dialog').getByRole('heading', { name: '祝福', exact: true })).toBeVisible();
    await observer.keyboard.press('Escape');
  } finally { await table.close(); }
});

test('eight browsers finish three shared hits and preserve follower reduction on every hit', async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const table = await tableFixture(browser, request, 'multi-target-multi-hit', 8);
  try {
    const views = await watch(table);
    for(const page of table.pages)await page.reload();
    const result = await passToWithdrawal(table, views, info);
    expect(result.players[table.sessions[1]!.id]!.damage).toBe(18);
    expect(result.players[table.sessions[2]!.id]!.damage).toBe(21);
    expect(result.players[table.sessions[1]!.id]!.followers).toEqual([]);
    for(const [seat,page] of table.pages.entries()){await page.reload();const g=views.get(table.sessions[seat]!.id)!.game!;expect(g.players[table.sessions[1]!.id]!.damage).toBe(18);expect(g.players[table.sessions[2]!.id]!.damage).toBe(21);expect(g.players[table.sessions[1]!.id]!.followers).toEqual([]);}
  } finally { await table.close(); }
});

test('a concealed player can reveal while another seat holds interruption priority', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'third-party-interrupt');
  try {
    const views = await watch(table); const player = table.pages[3]!; const id = table.sessions[3]!.id;
    await expect(player.getByRole('status').filter({ hasText: '凛さんの判断を待っています' })).toBeVisible();
    await player.getByRole('button', { name: '正体を公開', exact: true }).click();
    await expect.poll(() => views.get(table.sessions[0]!.id)?.game?.players[id]?.revealed).toBe(true);
    await expect(player.getByRole('button', { name: '正体を公開', exact: true })).toHaveCount(0);
    expect(views.get(table.sessions[0]!.id)?.game?.players[id]?.characterId).toBe(table.expected!.players[id]!.characterId);
  } finally { await table.close(); }
});
