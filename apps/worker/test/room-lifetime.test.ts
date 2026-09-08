import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds } from '@madou/engine';
import type { ClientEnvelope } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
it('restores a private lifetime choice and replays its committed death effect without applying it twice', async () => {
  const room = await openTestRoom('lifetime-soul');
  expect((await room.snapshotFor('A')).game!.lifetimeDecision).toMatchObject({ kind: 'soul-drain', actorId: 'A', targetId: 'B' });
  expect((await room.snapshotFor('B')).game!.lifetimeDecision).toBeNull();
  const before = await room.stored();
  await room.restart();
  expect(await room.stored()).toEqual(before);
  const request: ClientEnvelope = { protocolVersion: 1, commandId: 'soul-instant-death', expectedRevision: before.revision,
    ...activeWindowRef(before.state.game!)!, command: { type: 'CHOOSE_LIFETIME_EFFECT', choice: 'apply' } };
  const reply = await room.command('A', request);
  expect(reply).toMatchObject({ type: 'ack' });
  const committed = await room.stored();
  expect(committed.state.game!.players.B!.presence).toBe('pending-death');
  expect(committed.state.game!.windows?.at(-1)?.kind).toBe('death-gift');
  expect(committed.state.game!.players.A!.hand).toEqual(before.state.game!.players.A!.hand);
  expect(new Set(allCardInstanceIds(committed.state.game!)).size).toBe(220);
  await room.restart();
  expect(await room.command('A', request)).toEqual(reply);
  expect(await room.stored()).toEqual(committed);
  expect((await room.snapshotFor('B')).game!.lifecycleDecision).toMatchObject({ kind: 'death-gift', actorId: 'B' });
});
