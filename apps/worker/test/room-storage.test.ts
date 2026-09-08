import { env } from 'cloudflare:workers';
import { evictDurableObject, reset } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProbeCommit } from './fixtures/store-worker.js';

afterEach(async () => { await reset(); });

function command(id = 'command-1', revision = 0): ProbeCommit {
  return {
    actorId: 'A', commandId: id, request: '{"type":"PASS_SETUP"}',
    expectedRevision: revision,
    state: { count: revision + 1, secret: 'player-A-secret' },
    events: [{ type: 'private-draw', privateValue: 'card-7' }],
    projection: { roomId: 'room-1', occupied: 4 },
  };
}

describe('room SQLite transaction boundary', () => {
  it('initializes only once and persists the complete bundle through eviction', async () => {
    const room = env.PROBE.getByName('room');
    expect(await room.initialize()).toBe(true);
    expect(await room.initialize()).toBe(false);
    expect(await room.commit(command())).toEqual({ ok: true, revision: 1, replayed: false });
    await evictDurableObject(room);
    expect(await room.snapshot()).toEqual({ revision: 1, state: command().state });
    expect(await room.events()).toEqual([{ id: 1, revision: 1, event: command().events[0] }]);
    expect(await room.pending()).toEqual([{ revision: 1, projection: command().projection, attempts: 0, nextAttemptAt: 0 }]);
  });

  it('replays a committed command after eviction without duplicating cards or events', async () => {
    const room = env.PROBE.getByName('room');
    await room.initialize();
    await room.commit(command());
    await room.commit(command('command-2', 1));
    await evictDurableObject(room);
    expect(await room.commit(command())).toEqual({ ok: true, revision: 1, replayed: true });
    expect((await room.snapshot())?.revision).toBe(2);
    expect(await room.events()).toHaveLength(2);
  });

  it('can identify retries before evaluating a now-illegal game command', async () => {
    const room = env.PROBE.getByName('room');
    await room.initialize();
    expect(await room.receipt(command())).toBeNull();
    await room.commit(command());
    await evictDurableObject(room);
    expect(await room.receipt(command())).toEqual({ ok: true, revision: 1, replayed: true });
    expect(await room.receipt(command('command-1', 1))).toEqual({ ok: false, code: 'COMMAND_ID_REUSED' });
  });

  it('rejects reused command IDs with different content and stale commands', async () => {
    const room = env.PROBE.getByName('room');
    await room.initialize();
    await room.commit(command());
    expect(await room.commit({ ...command(), request: '{"type":"REVEAL_CHARACTER"}' })).toEqual({ ok: false, code: 'COMMAND_ID_REUSED' });
    expect(await room.commit(command('new-id'))).toEqual({ ok: false, code: 'STALE_REVISION' });
    expect(await room.events()).toHaveLength(1);
  });

  it('scopes command IDs to the actor and serializes competing revisions', async () => {
    const room = env.PROBE.getByName('room');
    await room.initialize();
    const results = await Promise.all([
      room.commit(command()),
      room.commit({ ...command(), actorId: 'B' }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, code: 'STALE_REVISION' }]);
    const losingActor = results[0]?.ok ? 'B' : 'A';
    expect(await room.commit({ ...command('command-1', 1), actorId: losingActor })).toEqual({ ok: true, revision: 2, replayed: false });
  });

  it('rolls back the snapshot, events, receipt and outbox together on storage failure', async () => {
    const room = env.PROBE.getByName('room');
    await room.initialize();
    await room.failEventWrite();
    expect(await room.commit(command())).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    expect((await room.snapshot())?.revision).toBe(0);
    expect(await room.events()).toEqual([]);
    expect(await room.pending()).toEqual([]);
    await room.clearFailure();
    expect(await room.commit(command())).toEqual({ ok: true, revision: 1, replayed: false });
  });

  it('persists outbox retries and acknowledges only the delivered revision', async () => {
    const room = env.PROBE.getByName('room');
    await room.initialize();
    await room.commit(command());
    await room.commit(command('second', 1));
    await room.retry(1, 2000);
    await room.delivered(2);
    await evictDurableObject(room);
    expect(await room.pending()).toEqual([]);
    await room.retry(1, 500);
    expect(await room.pending()).toEqual([{ revision: 1, projection: command().projection, attempts: 2, nextAttemptAt: 500 }]);
  });

  it('never creates a game from a command addressed to an uninitialized room', async () => {
    const room = env.PROBE.getByName('missing');
    expect(await room.snapshot()).toBeNull();
    expect(await room.commit(command())).toEqual({ ok: false, code: 'NOT_INITIALIZED' });
    expect(await room.events()).toEqual([]);
  });
});
