import { env } from 'cloudflare:workers';
import { createExecutionContext, reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index.js';
import { ruleset } from '@madou/catalog';
import { RoomStorage } from '../src/rooms/storage.js';
import type { RoomData } from '../src/rooms/types.js';

const origin = 'https://game.example';
beforeEach(async () => {
  await env.DB.exec('CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, actor_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, expires_at INTEGER NOT NULL)');
});
afterEach(async () => { await reset(); });
function request(path: string, options: { method?: string; body?: string; cookie?: string; origin?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.cookie) headers.set('Cookie', options.cookie);
  if (options.origin !== undefined) headers.set('Origin', options.origin);
  return worker.fetch(new Request(origin + path, { method: options.method ?? 'GET', headers, ...(options.body !== undefined ? { body: options.body } : {}) }), env, createExecutionContext());
}
const create = (name = 'あかり', cookie?: string) => request('/api/sessions', { method: 'POST', body: JSON.stringify({ name }), origin, ...(cookie ? { cookie } : {}) });
function cookie(response: Response) { return response.headers.get('Set-Cookie')!.split(';')[0]!; }

describe('guest session HTTP boundary', () => {
  it('creates a server identity, stores only a credential hash and restores via a secure cookie', async () => {
    const response = await create();
    expect(response.status).toBe(201);
    expect(response.headers.get('Set-Cookie')).toMatch(/^__Host-madou_session=[A-Za-z0-9_-]{43};/);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(response.headers.get('Set-Cookie')).toContain(flag);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const session = await response.json<{ id: string; name: string }>();
    expect(session).toEqual({ id: expect.any(String), name: 'あかり' });
    const stored = await env.DB.prepare('SELECT * FROM sessions').first();
    expect(stored?.actor_id).toBe(session.id);
    expect(JSON.stringify(stored)).not.toContain(cookie(response).split('=')[1]);
    const restored = await request('/api/sessions/current', { cookie: cookie(response) });
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual(session);
  });

  it('retains identity on creation retry while allowing duplicate display names for different guests', async () => {
    const first = await create();
    const identity = await first.json();
    const retry = await create('別の名前', cookie(first));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(identity);
    const other = await create();
    expect(await other.json()).not.toEqual(identity);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first())?.n).toBe(2);
  });

  it('rejects missing, forged, duplicate and expired cookies without revealing session details', async () => {
    expect((await request('/api/sessions/current')).status).toBe(401);
    expect((await request('/api/sessions/current', { cookie: '__Host-madou_session=' + 'A'.repeat(43) })).status).toBe(401);
    const created = await create();
    expect((await request('/api/sessions/current', { cookie: cookie(created) + '; ' + cookie(created) })).status).toBe(401);
    await env.DB.exec('UPDATE sessions SET expires_at = 1');
    const expired = await request('/api/sessions/current', { cookie: cookie(created) });
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual({ error: 'UNAUTHENTICATED' });
  });

  it('requires an exact same origin for session creation', async () => {
    for (const supplied of [undefined, 'null', 'https://evil.example', 'https://game.example.evil', 'http://game.example']) {
      const response = await request('/api/sessions', { method: 'POST', body: '{"name":"A"}', ...(supplied ? { origin: supplied } : {}) });
      expect(response.status).toBe(403);
    }
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first())?.n).toBe(0);
  });

  it('bounds and validates names and bodies and rejects client-supplied identity', async () => {
    for (const body of ['{', 'null', '[]', '{"name":""}', '{"name":"  "}', '{"name":"A\\nB"}', JSON.stringify({ name: 'あ'.repeat(25) }), '{"name":"A","id":"victim"}', '{"name":"A","__proto__":{}}']) {
      expect((await request('/api/sessions', { method: 'POST', body, origin })).status).toBe(400);
    }
    expect((await request('/api/sessions', { method: 'POST', body: JSON.stringify({ name: 'A'.repeat(5000) }), origin })).status).toBe(413);
    const trimmed = await create('  太郎  ');
    expect(await trimmed.json()).toMatchObject({ name: '太郎' });
  });

  it('rejects form content and uses generic errors if the database fails', async () => {
    const wrong = await worker.fetch(new Request(origin + '/api/sessions', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: '{"name":"A"}' }), env, createExecutionContext());
    expect(wrong.status).toBe(415);
    await env.DB.exec('DROP TABLE sessions');
    const response = await create();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'INTERNAL_ERROR' });
  });

  it('authenticates WebSocket identity from the cookie and ignores attacker-supplied internal headers', async () => {
    const a = await create('A');
    const identity = await a.json<{ id: string; name: string }>();
    const b = await create('B');
    const roomId = crypto.randomUUID();
    await runInDurableObject(env.ROOMS.getByName(roomId), (_instance, state) => {
      const room: RoomData = { schemaVersion: 1, roomId, title: 'Private', ownerId: identity.id, rulesetId: ruleset.id,
        capacity: 4, visibility: 'private', status: 'lobby', createdAt: 0,
        members: { [identity.id]: { ...identity, ready: false, joinedAt: 0 } }, inviteHash: 'secret', game: null };
      new RoomStorage(state.storage).initialize(room);
    });
    const path = `/api/rooms/${roomId}/ws`;
    const headers = { Upgrade: 'websocket', 'X-Room-Actor': identity.id };
    expect((await request(path, { origin, headers })).status).toBe(401);
    expect((await request(path, { origin, headers, cookie: cookie(b) })).status).toBe(403);
    expect((await request(path, { origin: 'https://evil.example', headers, cookie: cookie(a) })).status).toBe(403);
    expect((await request(path, { headers, cookie: cookie(a) })).status).toBe(403);
    expect((await request(path, { origin, cookie: cookie(a) })).status).toBe(426);
    const accepted = await request(path, { origin, cookie: cookie(a), headers: { Upgrade: 'websocket', 'X-Room-Actor': 'someone-else' } });
    expect(accepted.status).toBe(101);
    expect(accepted.webSocket).toBeDefined();
    accepted.webSocket!.accept();
    accepted.webSocket!.close();
  });
});
