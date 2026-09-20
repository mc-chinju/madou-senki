import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { createGame, logPage, LOG_PAGE_MAX, LOG_WINDOW, type GameState, type LogView } from '@madou/engine';
import { playOneStep } from '@madou/engine/bot';
import { MAX_LOG_PAGE } from '@madou/protocol';
import { seededEntropy } from '../../../packages/engine/test/fixtures.js';
import { openTestRoom } from './fixtures/recovery-room.js';

/** A record longer than one snapshot carries, so the paging boundaries are real rather than assumed. */
const ACTORS = ['A', 'B', 'C', 'D'];
function longGame(): GameState {
  const seed = 15, entropy = seededEntropy(seed);
  let state = createGame(ACTORS.map(id => ({ id, name: `${id}さん` })), entropy);
  for (let steps = 0; !state.outcome && steps < 5000; steps++) state = playOneStep(state, entropy, seed);
  return state;
}
const game = longGame();
const publicEvents = game.events.filter(event => event.audience === 'public');
type Page = { type: 'log-page'; requestId: string; beforeId: number; logStart: number; logs: LogView[]; privateLogs: LogView[] };

async function room() { return openTestRoom('canonical-S16', ACTORS, game); }
async function ask(session: Awaited<ReturnType<Awaited<ReturnType<typeof room>>['connect']>>, requestId: string, beforeId: number, limit = MAX_LOG_PAGE): Promise<Page> {
  session.inbox.socket.send(JSON.stringify({ type: 'LOG_PAGE', requestId, beforeId, limit }));
  const reply = await session.inbox.next(message => message.type === 'log-page');
  return reply as unknown as Page;
}
afterEach(async () => { await reset(); });

it('a bot game outgrows one snapshot, and its older pages walk back to the first record', async () => {
  expect(publicEvents.length).toBeGreaterThan(LOG_WINDOW * 2);
  expect(game.outcome).toBeTruthy();
  const open = await room();
  const session = await open.connect('A');
  // A finished game still answers: the record outlives the play it came from.
  expect(session.view.game!.logs).toHaveLength(LOG_WINDOW);
  expect(session.view.game!.logStart).toBe(publicEvents[0]!.id);
  const gathered: LogView[] = [...session.view.game!.logs];
  for (let page = 0; gathered[0]!.id > session.view.game!.logStart && page < 40; page++) {
    const reply = await ask(session, `page-${page}`, gathered[0]!.id, 60);
    expect(reply.beforeId).toBe(gathered[0]!.id);
    expect(reply.logStart).toBe(session.view.game!.logStart);
    // A page stops strictly before the id it was given, so nothing is served twice and nothing is skipped.
    expect(reply.logs.at(-1)!.id).toBeLessThan(gathered[0]!.id);
    expect(reply.logs.length).toBeLessThanOrEqual(60);
    gathered.unshift(...reply.logs);
  }
  expect(gathered.map(log => log.id)).toEqual(publicEvents.map(event => event.id));
  // Asking before the very first record has nothing left to give, which is how the reader learns it is done.
  expect((await ask(session, 'past-start', publicEvents[0]!.id)).logs).toEqual([]);
  session.inbox.socket.close();
});

it('a page never carries what its reader may not see, and is capped however much is asked for', async () => {
  const open = await room();
  const others = ACTORS.filter(id => id !== 'A').map(id => game.players[id]!);
  const shown = new Set(publicEvents.flatMap(event => [event.cardInstanceId, event.death?.sourceCardInstanceId]));
  const secrets = [
    ...others.flatMap(p => [...p.hand, ...[...p.followers, ...p.chants].filter(card => !card.revealed).map(card => card.cardInstanceId)]),
    ...others.filter(p => !p.revealed).map(p => p.characterId),
    ...game.discard.filter(entry => entry.ownerId !== 'A' && !shown.has(entry.cardInstanceId)).map(entry => entry.cardInstanceId),
  ].filter(Boolean);
  expect(secrets.length).toBeGreaterThan(0);
  const session = await open.connect('A');
  const newest = publicEvents.at(-1)!.id + 1;
  // Asking for more than the transport allows is refused outright, so a page can never grow past its cap.
  session.inbox.socket.send(JSON.stringify({ type: 'LOG_PAGE', requestId: 'too-much', beforeId: newest, limit: MAX_LOG_PAGE + 1 }));
  expect(await session.inbox.next(message => message.type !== 'snapshot')).toMatchObject({ type: 'error', code: 'INVALID_COMMAND' });
  const capped = await ask(session, 'capped', newest, MAX_LOG_PAGE);
  expect(capped.logs).toHaveLength(Math.min(MAX_LOG_PAGE, publicEvents.length));
  expect(LOG_PAGE_MAX).toBe(MAX_LOG_PAGE);
  const wire = JSON.stringify([capped, await ask(session, 'earlier', capped.logs[0]!.id, MAX_LOG_PAGE)]);
  for (const secret of secrets) expect(wire, `${secret} reached a seat that may not see it`).not.toContain(secret);
  // The page is the same projection a snapshot uses, so a seat reads its own record and no one else's.
  expect(capped.privateLogs.every(log => log.id >= capped.logs[0]!.id)).toBe(true);
  for (const actorId of ACTORS) {
    const page = logPage(game, actorId, { beforeId: newest, limit: MAX_LOG_PAGE });
    const seat = await open.connect(actorId);
    expect(await ask(seat, `same-${actorId}`, newest, MAX_LOG_PAGE)).toMatchObject({ logs: page.logs, privateLogs: page.privateLogs });
    seat.inbox.socket.close();
  }
  session.inbox.socket.close();
});

it('a reader picks the record up again after a reconnection, and a passive tab may read it too', async () => {
  const open = await room();
  const first = await open.connect('A');
  const middle = await ask(first, 'before-drop', publicEvents.at(-1)!.id + 1, 60);
  first.inbox.socket.close();
  await open.restart();
  // A second connection makes the first read-only; reading the record commits nothing, so it still answers.
  const passive = await open.connect('A'), active = await open.connect('A');
  expect(active.view.readOnly).toBe(false);
  const resumed = await ask(passive, 'after-reconnect', middle.logs[0]!.id, 60);
  expect(resumed.logs.at(-1)!.id).toBeLessThan(middle.logs[0]!.id);
  expect(resumed.logs).toEqual(logPage(game, 'A', { beforeId: middle.logs[0]!.id, limit: 60 }).logs);
  passive.inbox.socket.close(); active.inbox.socket.close();
});
