import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, type GameCommand } from '@madou/engine';
import { openTestRoom } from './fixtures/recovery-room.js';
afterEach(async () => { await reset(); });
it.each(['suppression-hidden-ordinary', 'follower-attack-griffin'] as const)('DO G09 %s declines dedicated use across turn end eviction and replay', async scenario => {
  const room = await openTestRoom(scenario), before = (await room.stored()).state.game!;
  const own = (await room.snapshotFor('A')).game!; let sequence = 0;
  if (scenario === 'suppression-hidden-ordinary') expect(own.abilityOptions.some(o => o.abilityId === 'c2-p07-r1c2-ab03')).toBe(true);
  else expect(own.followerBundleOptions.some(o => o.abilityId === 'c2-p05-r1c2-ab02')).toBe(true);
  async function privacy() {
    for (const actor of ['B', 'C', 'D']) {
      const view = (await room.snapshotFor(actor)).game!;
      expect(view.followerBundleOptions).toEqual([]);
      expect(view.abilityOptions.some(o => o.abilityId === 'c2-p07-r1c2-ab03')).toBe(false);
      if (!before.players.A!.revealed) expect(view.players.A).not.toHaveProperty('characterId');
    }
  }
  async function send(command: GameCommand) {
    const stored = await room.stored();
    const envelope = { protocolVersion: 1 as const, commandId: `g09-decline-${sequence++}`, expectedRevision: stored.revision, ...activeWindowRef(stored.state.game!), command };
    const reply = await room.command('A', envelope); expect(reply).toMatchObject({ type: 'ack' });
    const committed = await room.stored(); await room.restart();
    expect(await room.command('A', envelope)).toEqual(reply); expect(await room.stored()).toEqual(committed);
    expect(allCardInstanceIds(committed.state.game!)).toHaveLength(220); expect(new Set(allCardInstanceIds(committed.state.game!)).size).toBe(220);
    await privacy();
  }
  await privacy();
  if (before.phase === 'action') await send({ type: 'PASS_ACTION' });
  const excess = Math.max(0, own.self.hand.length - own.self.stats.handLimit), discardIds = own.self.hand.slice(0, excess);
  await send({ type: 'END_TURN', discardIds });
  const done = (await room.stored()).state.game!;
  expect(done.phase).toBe('turn-start'); expect(done.turnSeat).toBe(1);
  expect(done.used).toEqual(before.used); expect(done.abilities).toEqual(before.abilities);
  expect(done.followerBundles).toEqual(before.followerBundles);
  expect(done.suppressionDesignations).toEqual(before.suppressionDesignations); expect(done.blessingLeases).toEqual(before.blessingLeases);
  expect(done.players.A!.followers).toEqual(before.players.A!.followers);
  const retained = before.players.A!.hand.filter(id => !discardIds.includes(id));
  const refill = Math.max(0, own.self.stats.handLimit - retained.length);
  expect(done.players.A!.hand).toEqual([...retained, ...before.deck.slice(0, refill)]);
  expect(done.deck).toEqual(before.deck.slice(refill));
  for (const actor of ['B', 'C', 'D']) expect(done.players[actor]).toEqual(before.players[actor]);
});
