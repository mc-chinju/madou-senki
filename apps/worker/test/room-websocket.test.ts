import { env } from 'cloudflare:workers';
import { evictDurableObject, reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { allCardInstanceIds, createGame } from '@madou/engine';
import { getAction, ruleset } from '@madou/catalog';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomStorage } from '../src/rooms/storage.js';
import type { RoomData, RoomEvent, RoomProjection, RoomView } from '../src/rooms/types.js';
import type { ServerMessage } from '@madou/protocol';

afterEach(async () => { vi.restoreAllMocks(); await reset(); });
type Message = ServerMessage<RoomView>;

async function fixture(withFollower = false) {
  const room = env.ROOMS.getByName('socket-room');
  const players = ['A', 'B', 'C', 'D'].map(id => ({ id, name: `Player ${id}` }));
  const game = createGame(players, { now: 1000, dice: [], random: Array(2000).fill(0.75) }, { startingSeat: 0 });
  if (withFollower) {
    // Fixed valid scenario: exchange one physical card, retaining all 220 instances.
    const goblin = 'a2-p18-r3c1';
    const hand = game.players.A!.hand;
    if (!hand.includes(goblin)) {
      const source = [game.deck, ...Object.values(game.players).map(p => p.hand)].find(zone => zone.includes(goblin))!;
      source[source.indexOf(goblin)] = hand[0]!;
      hand[0] = goblin;
    }
    // This fixture begins after dealing; omit historical draw associations changed by the exchange.
    game.events = game.events.filter(e => e.type !== 'CARD_DRAWN');
    expect(new Set(allCardInstanceIds(game)).size).toBe(220);
    expect(allCardInstanceIds(game)).toHaveLength(220);
  }
  const data: RoomData = {
    schemaVersion: 1, roomId: 'socket-room', title: 'Local game', ownerId: 'A', rulesetId: ruleset.id,
    capacity: 4, visibility: 'private', status: 'playing', createdAt: 1000,
    members: Object.fromEntries(players.map(p => [p.id, { ...p, ready: true, joinedAt: 1000 }])),
    inviteHash: 'server-only-invite-hash', game,
  };
  await runInDurableObject(room, (_instance, state) => {
    new RoomStorage<RoomData, RoomEvent, RoomProjection>(state.storage).initialize(data);
  });
  return { room, game };
}

class Inbox {
  private messages: Message[] = [];
  private waiters: (() => void)[] = [];
  constructor(readonly socket: WebSocket) {
    socket.addEventListener('message', event => {
      this.messages.push(JSON.parse(String(event.data)) as Message);
      for (const wake of this.waiters.splice(0)) wake();
    });
    socket.accept();
  }
  send(value: unknown) { this.socket.send(JSON.stringify(value)); }
  has(predicate: (message: Message) => boolean): boolean { return this.messages.some(predicate); }
  async next(predicate: (message: Message) => boolean): Promise<Message> {
    for (;;) {
      const index = this.messages.findIndex(predicate);
      if (index >= 0) return this.messages.splice(index, 1)[0]!;
      await new Promise<void>(resolve => { this.waiters.push(resolve); });
    }
  }
  async snapshot(): Promise<RoomView> {
    const message = await this.next(m => m.type === 'snapshot');
    if (message.type !== 'snapshot') throw Error('Missing snapshot');
    return message.view;
  }
}

async function connect(room: DurableObjectStub<import('../src/rooms/room.js').Room>, actorId: string) {
  const response = await room.fetch('https://room.internal/connect', { headers: { Upgrade: 'websocket', 'X-Room-Actor': actorId } });
  expect(response.status).toBe(101);
  if (!response.webSocket) throw Error('No WebSocket');
  return new Inbox(response.webSocket);
}
const pass = (id: string, revision: number) => ({ protocolVersion: 1, commandId: id, expectedRevision: revision, command: { type: 'PASS_SETUP' } });

describe('room WebSocket and durable recovery', () => {
  it('sends only the seated viewer projection and rejects an unknown seat', async () => {
    const { room, game } = await fixture();
    const a = await connect(room, 'A');
    const view = await a.snapshot();
    const wire = JSON.stringify(view);
    expect(view.game?.self.hand).toEqual(game.players.A!.hand);
    expect(wire).not.toContain(game.players.B!.characterId);
    for (const card of game.players.B!.hand) expect(wire).not.toContain(card);
    expect(wire).not.toContain('server-only-invite-hash');
    expect((await room.fetch('https://room.internal/connect', { headers: { Upgrade: 'websocket', 'X-Room-Actor': 'stranger' } })).status).toBe(403);
  });

  it('resumes a hibernated socket and replays the saved acknowledgement', async () => {
    const { room } = await fixture();
    const a = await connect(room, 'A');
    const start = await a.snapshot();
    a.send(pass('one', start.revision));
    expect(await a.next(m => m.type === 'ack')).toEqual({ type: 'ack', commandId: 'one', revision: start.revision + 1 });
    const after = await a.snapshot();
    expect(after.game?.pending?.actorId).toBe('B');
    await evictDurableObject(room);
    a.send(pass('one', start.revision));
    expect(await a.next(m => m.type === 'ack')).toEqual({ type: 'ack', commandId: 'one', revision: after.revision });
    expect((await a.snapshot()).game?.pending?.actorId).toBe('B');
  });

  it('makes the newest connection active without letting old tabs submit', async () => {
    const { room } = await fixture();
    const old = await connect(room, 'A');
    const initial = await old.snapshot();
    const current = await connect(room, 'A');
    expect((await current.snapshot()).readOnly).toBe(false);
    expect((await old.snapshot()).readOnly).toBe(true);
    old.send(pass('old', initial.revision));
    expect(await old.next(m => m.type === 'error')).toMatchObject({ type: 'error', code: 'READ_ONLY_CONNECTION' });
    current.send(pass('new', initial.revision));
    expect(await current.next(m => m.type === 'ack')).toMatchObject({ type: 'ack', commandId: 'new' });
  });

  it('consumes a follower and draws its replacement only once across a retry', async () => {
    const { room, game } = await fixture(true);
    const card = game.players.A!.hand.find(id => getAction(id)?.category === 'follower');
    expect(card).toBeDefined();
    const a = await connect(room, 'A');
    const before = await a.snapshot();
    const request = { protocolVersion: 1, commandId: 'follower', expectedRevision: before.revision,
      command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: card } };
    a.send(request);
    await a.next(m => m.type === 'ack');
    const placed = await a.snapshot();
    expect(placed.game?.self.followers).toHaveLength(1);
    expect(placed.game?.self.hand).toHaveLength(5);
    expect(placed.game?.self.hand).not.toContain(card);
    await evictDurableObject(room);
    a.send(request);
    await a.next(m => m.type === 'ack');
    const replay = await a.snapshot();
    expect(replay.game?.self.hand).toEqual(placed.game?.self.hand);
    expect(replay.game?.self.followers).toEqual(placed.game?.self.followers);
    expect(replay.revision).toBe(placed.revision);
  });

  it('rejects stale revisions/windows, changed retries and actor impersonation', async () => {
    const { room } = await fixture();
    const a = await connect(room, 'A');
    const view = await a.snapshot();
    a.send({ ...pass('window', view.revision), windowId: 'old', windowRevision: 0 });
    expect(await a.next(m => m.type === 'error')).toMatchObject({ code: 'STALE_WINDOW' });
    a.send({ ...pass('actor', view.revision), actorId: 'B' });
    expect(await a.next(m => m.type === 'error')).toMatchObject({ code: 'INVALID_ENVELOPE' });
    a.send(pass('good', view.revision));
    await a.next(m => m.type === 'ack');
    a.send({ ...pass('good', view.revision), command: { type: 'REVEAL_CHARACTER' } });
    expect(await a.next(m => m.type === 'error')).toMatchObject({ code: 'COMMAND_ID_REUSED' });
    a.send(pass('stale', view.revision));
    expect(await a.next(m => m.type === 'error')).toMatchObject({ code: 'STALE_REVISION' });
  });

  it('rolls back the command bundle if durable alarm scheduling fails', async () => {
    const { room } = await fixture();
    const a = await connect(room, 'A');
    const before = await a.snapshot();
    await runInDurableObject(room, (_instance, state) => {
      vi.spyOn(state.storage, 'setAlarm').mockRejectedValueOnce(new Error('injected alarm fault'));
    });
    a.send(pass('atomic', before.revision));
    expect(await a.next(m => m.type === 'error')).toMatchObject({ code: 'INTERNAL_ERROR' });
    const rolledBack = await a.snapshot();
    expect(rolledBack.revision).toBe(before.revision);
    expect(rolledBack.game?.pending?.actorId).toBe('A');
    expect(await runInDurableObject(room, (_instance, state) => state.storage.getAlarm())).toBeNull();
    a.send(pass('atomic', before.revision));
    expect(await a.next(m => m.type === 'ack')).toMatchObject({ revision: before.revision + 1 });
  });

  it('repairs an ACK lost after persistence without executing the command twice', async () => {
    const { room } = await fixture();
    const a = await connect(room, 'A');
    const before = await a.snapshot();
    await runInDurableObject(room, (_instance, state) => {
      const socket = state.getWebSockets()[0]!;
      const send = socket.send.bind(socket);
      let drop = true;
      vi.spyOn(socket, 'send').mockImplementation(data => {
        if (drop && typeof data === 'string' && JSON.parse(data).type === 'ack') { drop = false; return; }
        send(data);
      });
    });
    a.send(pass('lost-ack', before.revision));
    expect((await a.snapshot()).game?.pending?.actorId).toBe('B');
    expect(a.has(m => m.type === 'ack')).toBe(false);
    vi.restoreAllMocks();
    await evictDurableObject(room, { webSockets: 'close' });
    const resumed = await connect(room, 'A');
    const recovered = await resumed.snapshot();
    resumed.send(pass('lost-ack', before.revision));
    expect(await resumed.next(m => m.type === 'ack')).toMatchObject({ commandId: 'lost-ack', revision: recovered.revision });
    expect((await resumed.snapshot()).game?.pending?.actorId).toBe('B');
  });

  it('keeps the saved game and retries a failed directory projection after eviction', async () => {
    const { room } = await fixture();
    const a = await connect(room, 'A');
    const before = await a.snapshot();
    a.send(pass('directory', before.revision));
    await a.next(m => m.type === 'ack');
    // The absent D1 table creates a real binding failure; the local transaction remains committed.
    expect(await runDurableObjectAlarm(room)).toBe(true);
    const retry = await runInDurableObject(room, (_instance, state) =>
      state.storage.sql.exec<{ attempts: number; next_attempt_at: number }>('SELECT attempts, next_attempt_at FROM room_outbox').one());
    expect(retry.attempts).toBe(1);
    await env.DB.exec('CREATE TABLE room_directory (room_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, listing TEXT)');
    await evictDurableObject(room);
    vi.spyOn(Date, 'now').mockReturnValue(retry.next_attempt_at + 1);
    expect(await runDurableObjectAlarm(room)).toBe(true);
    expect(await env.DB.prepare('SELECT revision, listing FROM room_directory WHERE room_id = ?').bind('socket-room').first())
      .toEqual({ revision: before.revision + 1, listing: null });
    expect(await runInDurableObject(room, (_instance, state) =>
      state.storage.sql.exec<{ count: number }>('SELECT COUNT(*) AS count FROM room_outbox').one().count)).toBe(0);
    expect(await runInDurableObject(room, (_instance, state) => state.storage.getAlarm())).toBeNull();
  });

  it('continues broadcasting to others when one client cannot receive its snapshot', async () => {
    const { room } = await fixture();
    const a = await connect(room, 'A');
    const before = await a.snapshot();
    const b = await connect(room, 'B');
    await b.snapshot();
    await a.snapshot();
    await runInDurableObject(room, (_instance, state) => {
      const socket = state.getWebSockets().find(ws => ws.deserializeAttachment()?.actorId === 'A')!;
      const send = socket.send.bind(socket);
      vi.spyOn(socket, 'send').mockImplementation(data => {
        if (typeof data === 'string' && JSON.parse(data).type === 'snapshot') throw new Error('injected send failure');
        send(data);
      });
    });
    a.send(pass('broadcast', before.revision));
    await a.next(m => m.type === 'ack');
    expect((await b.snapshot()).game?.pending?.actorId).toBe('B');
    vi.restoreAllMocks();
    const resumed = await connect(room, 'A');
    expect((await resumed.snapshot()).game?.pending?.actorId).toBe('B');
  });

  it('cannot overwrite a newer directory revision with a delayed outbox record', async () => {
    const { room } = await fixture();
    await env.DB.exec('CREATE TABLE room_directory (room_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, listing TEXT)');
    await env.DB.prepare('INSERT INTO room_directory VALUES (?, ?, ?)').bind('socket-room', 100, '{"title":"newest"}').run();
    const a = await connect(room, 'A');
    const before = await a.snapshot();
    a.send(pass('late', before.revision));
    await a.next(m => m.type === 'ack');
    await runDurableObjectAlarm(room);
    expect(await env.DB.prepare('SELECT revision, listing FROM room_directory').first()).toEqual({ revision: 100, listing: '{"title":"newest"}' });
  });
});
