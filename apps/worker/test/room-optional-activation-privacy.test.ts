import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, type GameCommand } from '@madou/engine';
import type { ClientEnvelope } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
it.each([false, true])('G09 optional critical use %s survives eviction and replay without exposing identity', async use => {
  const room = await openTestRoom('ability-critical');
  const abilityId = 'c2-p04-r2c2-ab03';
  const before = await room.stored();
  let sequence = 0;
  async function privateViews() {
    for (const actor of ['B', 'C', 'D']) {
      const view = (await room.snapshotFor(actor)).game!;
      expect(view.players.A).not.toHaveProperty('characterId');
      expect(JSON.stringify(view)).not.toContain('c2-p04-r2c2');
      expect(view.abilityOptions.some(option => option.abilityId === abilityId)).toBe(false);
    }
  }
  async function send(actor: string, command: GameCommand) {
    const stored = await room.stored();
    const envelope: ClientEnvelope = { protocolVersion: 1, commandId: `optional-${sequence++}`,
      expectedRevision: stored.revision, ...activeWindowRef(stored.state.game!)!, command };
    const reply = await room.command(actor, envelope);
    expect(reply).toMatchObject({ type: 'ack' });
    const committed = await room.stored();
    const views = await Promise.all(['A', 'B', 'C', 'D'].map(async id => (await room.snapshotFor(id)).game));
    await room.restart();
    expect(await room.command(actor, envelope)).toEqual(reply);
    expect(await room.stored()).toEqual(committed);
    expect(await Promise.all(['A', 'B', 'C', 'D'].map(async id => (await room.snapshotFor(id)).game))).toEqual(views);
    expect(allCardInstanceIds(committed.state.game!)).toHaveLength(220);
    expect(new Set(allCardInstanceIds(committed.state.game!)).size).toBe(220);
    await privateViews();
  }
  await privateViews();
  await room.restart();
  expect(await room.stored()).toEqual(before);
  if (use) {
    const option = (await room.snapshotFor('A')).game!.abilityOptions.find(option => option.abilityId === abilityId)!;
    await send('A', { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId });
    expect((await room.snapshotFor('B')).game!.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
  }
  for (let n = 0; n < 300; n++) {
    const game = (await room.stored()).state.game!;
    const window = game.windows?.at(-1);
    if (!window) break;
    await send(window.participants[window.cursor]!, { type: 'PASS' });
  }
  const done = (await room.stored()).state.game!;
  expect(done.windows ?? []).toEqual([]);
  expect(done.players.A!.revealed).toBe(false);
  expect(done.used?.filter(key => key.includes(abilityId)) ?? []).toHaveLength(use ? 1 : 0);
  const rolls = done.rolls?.filter(roll => roll.purpose === 'ability-value') ?? [];
  expect(rolls).toHaveLength(use ? 1 : 0);
  if (use) {
    const faces = rolls[0]!.faces;
    expect(faces).toHaveLength(2);
    if (faces[0] === faces[1]) expect(done.players.B!.presence).toBe('dead');
    else expect(done.players.B!.damage).toBe(Math.abs(faces[0]! - faces[1]!) === 1 ? 8 : 4);
  } else {
    expect(done.players.B!.damage).toBe(4);
    expect(done.used).toEqual(before.state.game!.used);
  }
  await privateViews();
});
