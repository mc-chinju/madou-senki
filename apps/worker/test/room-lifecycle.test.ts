import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds } from '@madou/engine';
import type { ClientEnvelope } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
type TestRoom = Awaited<ReturnType<typeof openTestRoom>>;
async function envelope(room: TestRoom, commandId: string, command: ClientEnvelope['command']): Promise<ClientEnvelope> {
  const current = await room.stored();
  return { protocolVersion: 1, commandId, expectedRevision: current.revision,
    ...activeWindowRef(current.state.game!)!, command };
}
async function finishWindows(room: TestRoom) {
  let last: { actorId: string; request: ClientEnvelope; reply: unknown } | undefined;
  for (let i = 0; i < 200; i++) {
    const snapshot = await room.stored();
    const window = snapshot.state.game!.windows?.at(-1);
    if (!window) return last;
    const actorId = window.participants[window.cursor]!;
    const request = await envelope(room, `lifecycle-pass-${i}`, { type: 'PASS' });
    const reply = await room.command(actorId, request);
    expect(reply).toMatchObject({ type: 'ack' });
    last = { actorId, request, reply };
  }
  throw Error('LIFECYCLE_DID_NOT_FINISH');
}

it('atomically finishes the room, restores its result and replays the winning command after eviction', async () => {
  const room = await openTestRoom('lifecycle-finish');
  const last = await finishWindows(room);
  expect(last).toBeDefined();
  const completed = await room.stored();
  expect(completed.state.game!.outcome).toMatchObject({ kind: 'victory', winnerIds: ['A', 'C', 'D'] });
  expect(completed.state.status).toBe('finished');
  await room.restart();
  expect(await room.command(last!.actorId, last!.request)).toEqual(last!.reply);
  expect(await room.stored()).toEqual(completed);
  const late = await envelope(room, 'late-start', { type: 'START_TURN' });
  expect(await room.command('A', late)).toMatchObject({ type: 'error', code: 'INVALID_ACTION' });
  expect(await room.stored()).toEqual(completed);
  const winner = await room.snapshotFor('A'); const loser = await room.snapshotFor('B');
  expect(winner.status).toBe('finished');
  expect(winner.game!.outcome).toEqual(completed.state.game!.outcome);
  expect(loser.game!.outcome).toEqual(winner.game!.outcome);
  for (const actorId of ['A', 'B', 'C', 'D']) {
    const close = await envelope(room, `close-${actorId}`, { type: 'CLOSE_BY_AGREEMENT', agree: true });
    expect(await room.command(actorId, close)).toMatchObject({ type: 'ack' });
  }
  const closed = await room.stored();
  expect(closed.state.status).toBe('closed');
  expect(closed.state.game!.outcome).toEqual(completed.state.game!.outcome);
});

it('persists a stalemate with living otherworld survivors and replays its ending command after eviction', async () => {
  const room = await openTestRoom('lifecycle-stalemate');
  const last = await finishWindows(room);
  expect(last).toBeDefined();
  const completed = await room.stored();
  expect(completed.state.status).toBe('finished');
  expect(completed.state.game!.outcome).toMatchObject({ kind: 'draw', reason: 'stalemate', winnerIds: [],
    results: { A: 'draw', B: 'draw', C: 'draw', D: 'draw' } });
  expect(completed.state.game!.players.B!.presence).toBe('otherworld');
  expect(completed.state.game!.players.C!.presence).toBe('otherworld');
  await room.restart();
  expect(await room.command(last!.actorId, last!.request)).toEqual(last!.reply);
  expect(await room.stored()).toEqual(completed);
  expect((await room.snapshotFor('B')).game!.outcome).toEqual(completed.state.game!.outcome);
  const late = await envelope(room, 'stalemate-late-start', { type: 'START_TURN' });
  expect(await room.command('B', late)).toMatchObject({ type: 'error', code: 'INVALID_ACTION' });
  expect(await room.stored()).toEqual(completed);
});

it('restores a pending death gift without duplicate cost and keeps the transferred hand card private', async () => {
  const room = await openTestRoom('death-gift');
  const gift = 'a2-p05-r2c3'; const source = 'a2-p02-r3c2';
  const initialHand = room.initial.players.B!.hand.length;
  const request = await envelope(room, 'death-gift', {
    type: 'PLAY_DEATH_GIFT', cardInstanceId: source, giftCardInstanceId: gift, targetId: 'C',
  });
  const reply = await room.command('B', request);
  expect(reply).toMatchObject({ type: 'ack' });
  const saved = await room.stored();
  expect(saved.state.game!.players.B!.hand).toHaveLength(initialHand - 1);
  expect(saved.state.game!.players.B!.hand).toContain(gift);
  expect(JSON.stringify(await room.snapshotFor('A'))).not.toContain(gift);
  await room.restart();
  expect(await room.command('B', request)).toEqual(reply);
  expect(await room.stored()).toEqual(saved);
  await finishWindows(room);
  const ended = (await room.stored()).state.game!;
  expect(ended.players.B!.presence).toBe('dead');
  expect(ended.players.B!.hand).toEqual([]);
  expect(ended.players.C!.hand).toContain(gift);
  expect(ended.discard).toContain(source);
  expect(JSON.stringify(await room.snapshotFor('A'))).not.toContain(gift);
  expect((await room.snapshotFor('C')).game!.self.hand).toContain(gift);
  expect(new Set(allCardInstanceIds(ended)).size).toBe(220);
});

it.each([false, true])('DO G09 hidden Lancelot transformation %s is explicit across eviction and replay', async use => {
  const room = await openTestRoom('lifecycle-transform-hidden');
  const initial = (await room.stored()).state.game!; let sequence = 0;
  async function send(actor: string, command: ClientEnvelope['command']) {
    const request = await envelope(room, `g09-transform-${sequence++}`, command);
    const reply = await room.command(actor, request); expect(reply).toMatchObject({ type: 'ack' });
    const saved = await room.stored(); await room.restart();
    expect(await room.command(actor, request)).toEqual(reply); expect(await room.stored()).toEqual(saved);
    expect(allCardInstanceIds(saved.state.game!)).toHaveLength(220);
    expect(new Set(allCardInstanceIds(saved.state.game!)).size).toBe(220);
  }
  async function settle() {
    for (let n = 0; n < 200; n++) {
      const w = (await room.stored()).state.game!.windows?.at(-1); if (!w) return;
      await send(w.participants[w.cursor]!, { type: 'PASS' });
    }
    throw Error('G09_TRANSFORM_WINDOW_LIMIT');
  }
  async function hidden() {
    for (const actor of ['B', 'C', 'D']) {
      const view = (await room.snapshotFor(actor)).game!;
      expect(view.players.A).not.toHaveProperty('characterId');
      expect(view.lifecycleAbilities).not.toContain('lancelot-transform');
    }
  }
  await send('B', { type: 'REVEAL_CHARACTER' }); await settle();
  expect((await room.snapshotFor('A')).game!.lifecycleAbilities).toContain('lancelot-transform');
  await hidden();
  if (use) { await send('A', { type: 'USE_LIFECYCLE_ABILITY', ability: 'lancelot-transform' }); await settle(); }
  else {
    await send('A', { type: 'PASS_ACTION' });
    const own = (await room.snapshotFor('A')).game!.self;
    await send('A', { type: 'END_TURN', discardIds: own.hand.slice(0, Math.max(0, own.hand.length - own.stats.handLimit)) });
  }
  const done = (await room.stored()).state.game!;
  expect(done.players.A!.characterId).toBe(use ? 'c2-p07-r1c1' : 'c2-p02-r2c2');
  expect(done.players.A!.revealed).toBe(use);
  expect(done.used?.filter(key => key.includes('c2-p02-r2c2-ab05')) ?? []).toHaveLength(use ? 1 : 0);
  if (!use) { expect(done.used).toEqual(initial.used); expect(done.abilities).toEqual(initial.abilities); await hidden(); }
}, 15000);
