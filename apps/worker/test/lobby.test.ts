import { env } from 'cloudflare:workers';
import { createExecutionContext, reset, runDurableObjectAlarm, runInDurableObject, evictDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ruleset } from '@madou/catalog';
import { createGame } from '@madou/engine';
import worker from '../src/index.js';
import type { ClientServerMessage } from '@madou/protocol';
import type { RoomData, RoomView } from '../src/rooms/types.js';
import { RoomStorage } from '../src/rooms/storage.js';

const origin = 'https://game.example';
beforeEach(async () => {
  await env.DB.exec('CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, actor_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, expires_at INTEGER NOT NULL)');
  await env.DB.exec('CREATE TABLE room_directory (room_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, listing TEXT)');
});
afterEach(async () => { await reset(); });
async function api(path: string, cookie?: string, body?: unknown) {
  const headers = new Headers({ Origin: origin });
  if (cookie) headers.set('Cookie', cookie);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(origin + path, { method: body === undefined ? 'GET' : 'POST', headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), env, createExecutionContext());
}
async function guest(name: string) {
  const response = await api('/api/sessions', undefined, { name });
  expect(response.status).toBe(201);
  const session = await response.json<{ id: string; name: string }>();
  return { ...session, cookie: response.headers.get('Set-Cookie')!.split(';')[0]! };
}
async function makeRoom(cookie: string, visibility = 'public') {
  const response = await api('/api/rooms', cookie, { title: '魔導戦記の卓', capacity: 4, visibility, rulesetId: ruleset.id });
  expect(response.status).toBe(201);
  return response.json<{ roomId: string; revision: number }>();
}
type Message = ClientServerMessage<RoomView>;
async function connect(roomId: string, cookie: string) {
  const response = await worker.fetch(new Request(`${origin}/api/rooms/${roomId}/ws`, {
    headers: { Origin: origin, Cookie: cookie, Upgrade: 'websocket' },
  }), env, createExecutionContext());
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  const queue: Message[] = [];
  let wake: (() => void) | null = null;
  socket.addEventListener('message', event => { queue.push(JSON.parse(String(event.data)) as Message); wake?.(); });
  socket.accept();
  async function next(predicate: (message: Message) => boolean): Promise<Message> {
    for (;;) {
      const index = queue.findIndex(predicate);
      if (index >= 0) return queue.splice(index, 1)[0]!;
      await new Promise<void>(resolve => { wake = resolve; });
    }
  }
  const first = await next(message => message.type === 'snapshot');
  if (first.type !== 'snapshot') throw Error('No snapshot');
  return { initial: first.view, async command(commandId: string, expectedRevision: number, command: unknown) {
    socket.send(JSON.stringify({ protocolVersion: 1, commandId, expectedRevision, command }));
    return next(message => message.type !== 'snapshot' && (message.commandId === commandId || message.commandId === undefined));
  } };
}
async function stored(roomId: string) {
  return runInDurableObject(env.ROOMS.getByName(roomId), (_instance, state) => new RoomStorage<RoomData, unknown, unknown>(state.storage).snapshot()!);
}

describe('table HTTP lifecycle', () => {
  it('checks only the current session seat without joining or revealing a private room exists', async () => {
    const [a, b] = await Promise.all(['A', 'B'].map(guest));
    const room = await makeRoom(a!.cookie, 'private');
    expect(await (await api(`/api/rooms/${room.roomId}/seat`, a!.cookie)).json()).toEqual({ seated: true });
    expect(await (await api(`/api/rooms/${room.roomId}/seat`, b!.cookie)).json()).toEqual({ seated: false });
    expect(await (await api(`/api/rooms/${crypto.randomUUID()}/seat`, b!.cookie)).json()).toEqual({ seated: false });
    expect((await api(`/api/rooms/${room.roomId}/seat`)).status).toBe(401);
    expect(Object.keys((await stored(room.roomId)).state.members)).toEqual([a!.id]);
  });
  it('creates a public table and only projects public recruitment metadata', async () => {
    const a = await guest('A');
    const room = await makeRoom(a.cookie);
    const hidden = await makeRoom(a.cookie, 'private');
    await runDurableObjectAlarm(env.ROOMS.getByName(room.roomId));
    await runDurableObjectAlarm(env.ROOMS.getByName(hidden.roomId));
    const listed = await api('/api/rooms', a.cookie);
    expect(listed.status).toBe(200);
    const body = await listed.json<{ rooms: unknown[] }>();
    expect(body.rooms).toEqual([{ roomId: room.roomId, revision: room.revision, title: '魔導戦記の卓', capacity: 4, occupied: 1, rulesetId: ruleset.id }]);
    expect(JSON.stringify(body)).not.toContain(hidden.roomId);
    expect(JSON.stringify(body)).not.toContain(a.id);
  });

  it('serializes simultaneous final-seat joins and treats a seated retry as restoration', async () => {
    const [a, b, c, d, e] = await Promise.all(['A', 'B', 'C', 'D', 'E'].map(guest));
    const room = await makeRoom(a!.cookie);
    const join = (cookie: string) => api(`/api/rooms/${room.roomId}/join`, cookie, {});
    expect((await join(b!.cookie)).status).toBe(200);
    expect((await join(c!.cookie)).status).toBe(200);
    const attempts = await Promise.all([join(d!.cookie), join(e!.cookie)]);
    expect(attempts.map(r => r.status).sort()).toEqual([200, 409]);
    const first = await join(a!.cookie);
    const retry = await join(a!.cookie);
    expect(first.status).toBe(200);
    expect(await retry.json()).toEqual(await first.json());
    await runDurableObjectAlarm(env.ROOMS.getByName(room.roomId));
    expect(await (await api('/api/rooms', a!.cookie)).json()).toMatchObject({ rooms: [{ occupied: 4 }] });
  });

  it('limits invitations to the owner, revokes previous tokens and preserves existing seats', async () => {
    const [a, b, c] = await Promise.all(['A', 'B', 'C'].map(guest));
    const room = await makeRoom(a!.cookie, 'private');
    const path = `/api/rooms/${room.roomId}`;
    expect((await api(path + '/join', b!.cookie, {})).status).toBe(403);
    expect((await api(path + '/invites', b!.cookie, { expectedRevision: room.revision })).status).toBe(403);
    const first = await api(path + '/invites', a!.cookie, { expectedRevision: room.revision });
    expect(first.status).toBe(200);
    const invitation = await first.json<{ token: string; revision: number }>();
    expect(invitation.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(await stored(room.roomId))).not.toContain(invitation.token);
    expect((await stored(room.roomId)).state.inviteHash).toMatch(/^[a-f0-9]{64}$/);
    const entered = await api(path + '/join', b!.cookie, { inviteToken: invitation.token });
    expect(entered.status).toBe(200);
    const seat = await entered.json<{ revision: number }>();
    const second = await api(path + '/invites', a!.cookie, { expectedRevision: seat.revision });
    expect(second.status).toBe(200);
    const rotated = await second.json<{ token: string }>();
    expect(rotated.token).not.toBe(invitation.token);
    expect((await api(path + '/join', c!.cookie, { inviteToken: invitation.token })).status).toBe(403);
    expect((await api(path + '/join', b!.cookie, {})).status).toBe(200);
    expect((await api(path + '/join', c!.cookie, { inviteToken: rotated.token })).status).toBe(200);
    expect((await api(path + '/invites', a!.cookie, { expectedRevision: room.revision })).status).toBe(409);
  });

  it('requires sessions and rejects invalid settings and actor injection', async () => {
    expect((await api('/api/rooms')).status).toBe(401);
    expect((await api('/api/rooms', undefined, {})).status).toBe(401);
    const a = await guest('A');
    const settings = { title: '卓', capacity: 4, visibility: 'public', rulesetId: ruleset.id };
    for (const change of [{ capacity: 3 }, { capacity: 11 }, { rulesetId: 'third' }, { title: '' }, { ownerId: 'victim' }]) {
      expect((await api('/api/rooms', a.cookie, { ...settings, ...change })).status).toBe(400);
    }
    const room = await makeRoom(a.cookie);
    expect((await api(`/api/rooms/${room.roomId}/join`, a.cookie, { actorId: 'victim' })).status).toBe(400);
    expect((await api(`/api/rooms/${crypto.randomUUID()}/join`, a.cookie, {})).status).toBe(403);
  });

  it('persists readiness, validates ownership/count, resets readiness on settings and guards incomplete rules', async () => {
    const guests = await Promise.all(['A', 'B', 'C', 'D'].map(guest));
    const room = await makeRoom(guests[0]!.cookie);
    for (const participant of guests.slice(1)) expect((await api(`/api/rooms/${room.roomId}/join`, participant.cookie, {})).status).toBe(200);
    const clients = await Promise.all(guests.map(g => connect(room.roomId, g.cookie)));
    let revision = (await stored(room.roomId)).revision;
    expect(await clients[1]!.command('owner', revision, { type: 'START' })).toMatchObject({ type: 'error', code: 'FORBIDDEN' });
    expect(await clients[0]!.command('unready', revision, { type: 'START' })).toMatchObject({ type: 'error', code: 'NOT_READY' });
    for (const [index, client] of clients.entries()) {
      expect(await client.command(`ready-${index}`, revision++, { type: 'READY', ready: true })).toMatchObject({ type: 'ack', revision });
    }
    expect(await clients[0]!.command('guard', revision, { type: 'START' })).toMatchObject({ type: 'error', code: 'RULESET_NOT_READY' });
    expect((await stored(room.roomId)).state.game).toBeNull();
    expect(await clients[0]!.command('settings', revision++, { type: 'UPDATE_SETTINGS', title: '五人卓', capacity: 5, visibility: 'private' })).toMatchObject({ type: 'ack', revision });
    const changed = (await stored(room.roomId)).state;
    expect(Object.values(changed.members).every(m => !m.ready)).toBe(true);
    expect(changed).toMatchObject({ title: '五人卓', capacity: 5, visibility: 'private' });
    await evictDurableObject(env.ROOMS.getByName(room.roomId));
    expect(await clients[0]!.command('ready-0', revision - 5, { type: 'READY', ready: true })).toMatchObject({ type: 'ack', revision: revision - 4 });
    expect(Object.values((await stored(room.roomId)).state.members).every(m => !m.ready)).toBe(true);
    await runDurableObjectAlarm(env.ROOMS.getByName(room.roomId));
    expect(await (await api('/api/rooms', guests[0]!.cookie)).json()).toEqual({ rooms: [] });
  });

  it('transfers ownership on lobby departure, acknowledges a repeated leave and closes an empty room', async () => {
    const [a, b] = await Promise.all(['A', 'B'].map(guest));
    const room = await makeRoom(a!.cookie);
    await api(`/api/rooms/${room.roomId}/join`, b!.cookie, {});
    const owner = await connect(room.roomId, a!.cookie);
    const revision = owner.initial.revision;
    const left = await owner.command('leave', revision, { type: 'LEAVE' });
    expect(left).toMatchObject({ type: 'ack', revision: revision + 1 });
    expect(await owner.command('leave', revision, { type: 'LEAVE' })).toEqual(left);
    const remaining = (await stored(room.roomId)).state;
    expect(remaining.ownerId).toBe(b!.id);
    expect(Object.keys(remaining.members)).toEqual([b!.id]);
    const next = await connect(room.roomId, b!.cookie);
    expect(await next.command('last', next.initial.revision, { type: 'LEAVE' })).toMatchObject({ type: 'ack' });
    expect((await stored(room.roomId)).state.status).toBe('closed');
    expect((await api(`/api/rooms/${room.roomId}/join`, a!.cookie, {})).status).toBe(409);
  });

  it('requires every current member to agree to closure and persists votes across eviction', async () => {
    const [a, b] = await Promise.all(['A', 'B'].map(guest));
    const room = await makeRoom(a!.cookie);
    await api(`/api/rooms/${room.roomId}/join`, b!.cookie, {});
    const first = await connect(room.roomId, a!.cookie);
    const second = await connect(room.roomId, b!.cookie);
    let revision = first.initial.revision;
    expect(await first.command('close-a', revision++, { type: 'CLOSE_BY_AGREEMENT', agree: true })).toMatchObject({ type: 'ack', revision });
    expect((await stored(room.roomId)).state.status).toBe('lobby');
    await evictDurableObject(env.ROOMS.getByName(room.roomId));
    expect(await second.command('close-b', revision++, { type: 'CLOSE_BY_AGREEMENT', agree: true })).toMatchObject({ type: 'ack', revision });
    expect((await stored(room.roomId)).state.status).toBe('closed');
  });

  it('preserves seats in a running game, refuses newcomers and allows agreed closure without inventing a winner', async () => {
    const guests = await Promise.all(['A', 'B', 'C', 'D', 'outsider'].map(guest));
    const room = await makeRoom(guests[0]!.cookie);
    for (const participant of guests.slice(1, 4)) await api(`/api/rooms/${room.roomId}/join`, participant.cookie, {});
    const game = createGame(guests.slice(0, 4).map(({ id, name }) => ({ id, name })), { now: 1000, dice: [], random: Array(2000).fill(0.75) });
    // Test-only running-game fixture; production START retains its catalog guard.
    await runInDurableObject(env.ROOMS.getByName(room.roomId), (_instance, state) => {
      const snapshot = new RoomStorage<RoomData, unknown, unknown>(state.storage).snapshot()!;
      snapshot.state.status = 'playing'; snapshot.state.game = game;
      state.storage.sql.exec('UPDATE room_snapshot SET value = ?', JSON.stringify(snapshot.state));
    });
    expect((await api(`/api/rooms/${room.roomId}/join`, guests[4]!.cookie, {})).status).toBe(409);
    expect((await api(`/api/rooms/${room.roomId}/join`, guests[0]!.cookie, {})).status).toBe(200);
    const clients = await Promise.all(guests.slice(0, 4).map(g => connect(room.roomId, g.cookie)));
    let revision = clients[0]!.initial.revision;
    expect(await clients[0]!.command('cannot-leave', revision, { type: 'LEAVE' })).toMatchObject({ type: 'error', code: 'ROOM_NOT_OPEN' });
    expect(await clients[0]!.command('cannot-restart', revision, { type: 'START' })).toMatchObject({ type: 'error', code: 'ROOM_NOT_OPEN' });
    expect(await clients[0]!.command('agree-then-retract', revision++, { type: 'CLOSE_BY_AGREEMENT', agree: true })).toMatchObject({ type: 'ack', revision });
    expect(await clients[0]!.command('retract', revision++, { type: 'CLOSE_BY_AGREEMENT', agree: false })).toMatchObject({ type: 'ack', revision });
    for (const [index, client] of clients.entries()) {
      expect(await client.command(`close-${index}`, revision++, { type: 'CLOSE_BY_AGREEMENT', agree: true })).toMatchObject({ type: 'ack', revision });
      expect((await stored(room.roomId)).state.status).toBe(index === 3 ? 'closed' : 'playing');
    }
    expect((await stored(room.roomId)).state.game).toEqual(game);
  });
});
