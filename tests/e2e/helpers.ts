import type { PlayerView } from '../../packages/engine/src/index.js';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { expect, type APIRequestContext, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test';
import { makeScenario, type ScenarioName } from '../../packages/engine/test/fixtures/game-scenarios.js';

export const origin = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 8787}`;

/** Signs a context in through the local test Worker's session route; login.spec covers the OTP screen itself. */
export async function signIn(context: BrowserContext, name: string): Promise<{ id: string; name: string }> {
  const response = await context.request.post('/__test/session', { data: { name } });
  expect(response.status()).toBe(201);
  return response.json();
}

let storedRoom: { request: APIRequestContext; roomId: string } | null = null;
/** Discard pile contents are never sent to players; browser tests read them from the saved game of the latest table. */
export async function storedDiscard(): Promise<string[]> {
  return (await storedGame()).discard;
}
async function storedGame(): Promise<{ phase: string; revision: number; discard: string[]; pending: { participantIds: string[]; readyIds: string[] } | null }> {
  if (!storedRoom) throw Error('NO_TABLE');
  const response = await storedRoom.request.get(`/__test/rooms/${storedRoom.roomId}/game`);
  expect(response.ok()).toBe(true);
  return response.json();
}

export async function tableFixture(browser: Browser, request: APIRequestContext, scenario?: ScenarioName, count = 4, options: BrowserContextOptions = {}) {
  const contexts = await Promise.all(Array.from({ length: count }, () => browser.newContext({ ...options, baseURL: origin })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const sessions: { id: string; name: string }[] = [];
  for (const [index, page] of pages.entries()) {
    sessions.push(await signIn(contexts[index]!, ['葵', '楓', '凛', '蓮', '澪', '樹', '紬', '湊', '旭', '翠'][index]!));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /ようこそ/ })).toBeVisible();
  }
  const created = await pages[0]!.evaluate(async capacity => {
    const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'ブラウザ検証', capacity, visibility: 'public', rulesetId: 'second-online-v0.1-provisional' }) });
    if (!response.ok) throw Error('CREATE_FAILED'); return response.json() as Promise<{ roomId: string }>;
  }, count);
  for (const page of pages.slice(1)) await page.evaluate(async roomId => {
    const response = await fetch(`/api/rooms/${roomId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok) throw Error('JOIN_FAILED');
  }, created.roomId);
  storedRoom = { request, roomId: created.roomId };
  if (scenario) {
    const seated = await request.post(`/__test/rooms/${created.roomId}/scenario`, { data: { name: scenario } });
    // The fixture Worker only seats the scenarios these specs ask for; a new spec has to be added to
    // BROWSER_SCENARIOS in e2e-worker.ts, and INVALID_FIXTURE here is what says so.
    if (!seated.ok()) throw Error(`FIXTURE_REFUSED ${scenario}: ${seated.status()} ${await seated.text()}`);
  }
  return { contexts, pages, sessions, roomId: created.roomId, url: `/rooms/${created.roomId}`,
    expected: scenario ? makeScenario(scenario, sessions) : null,
    async close() { await Promise.all(contexts.map(context => context.close())); },
  };
}

type Table = Awaited<ReturnType<typeof tableFixture>>;
export const windowPassButtonName = /^(パス(（この確認だけ）)?|回収せずに進む|託さずに進む|奪わずに進む|能力を使わず進む|追加攻撃をしない|追加しない|判定しない)$/;
export async function observe(table: Table) {
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
/** Presses 「配置を終える」; a seat that could still place a follower is asked once more inside the bar and confirms. */
export async function finishSetup(page: Page) {
  const finish = page.getByRole('button', { name: '配置を終える', exact: true });
  const confirm = page.getByRole('button', { name: '置かずに終える', exact: true });
  await finish.click();
  // React flushes the click synchronously, so an armed confirmation is already rendered when click() returns.
  if (await confirm.isVisible()) await confirm.click();
}
/** Ready every seat through the remaining concurrent setup rounds (G10); placements happen before this. */
export async function readySetup(table: Table) {
  for (let round = 0; round < 6; round++) {
    const game = await storedGame();
    if (game.phase !== 'setup' || !game.pending) return;
    for (const id of game.pending.participantIds) {
      if (game.pending.readyIds.includes(id)) continue;
      const page = table.pages[table.sessions.findIndex(session => session.id === id)]!;
      await finishSetup(page);
    }
    await expect.poll(async () => (await storedGame()).revision).toBeGreaterThan(game.revision);
  }
  throw Error('SETUP_DID_NOT_FINISH');
}
export async function passUntil(table: Table, views: Map<string, RoomView>, done: (game: PlayerView) => boolean, maxSteps = 100) {
  const owner = table.sessions[0]!.id;
  for (let i = 0; i < maxSteps; i++) {
    const current = views.get(owner)!; const game = current.game!;
    if (done(game)) return game;
    const window = game.activeWindow; expect(window).not.toBeNull();
    const page = table.pages[table.sessions.findIndex(session => session.id === window!.pendingActorId)]!;
    await page.getByRole('button', { name: windowPassButtonName }).click();
    await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(current.revision);
  }
  throw Error('Roll continuation did not reach its expected boundary');
}

/** Narrow public source before inspecting a physical technique. */
export function currentCardAction(game: PlayerView | null | undefined) {
  const action = game?.currentAction; return action?.source === 'card' ? action : null;
}
