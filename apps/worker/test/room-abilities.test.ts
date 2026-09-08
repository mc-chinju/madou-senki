import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds } from '@madou/engine';
import type { ClientEnvelope } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
it('persists a concealed ability declaration and its canceled cost through eviction and exact replay', async () => {
  const room = await openTestRoom('ability-hidden-cancel');
  const own = (await room.snapshotFor('A')).game!; const other = (await room.snapshotFor('B')).game!;
  expect(own.currentAction).toMatchObject({ source: 'ability', abilityId: 'c2-p04-r2c2-ab04' });
  expect(other.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
  expect(JSON.stringify(other)).not.toContain('c2-p04-r2c2');
  expect(other.abilityOptions).toEqual([]);
  expect(other.reactionTargetAbilityId).toBeTruthy();
  const before = await room.stored(); await room.restart(); expect(await room.stored()).toEqual(before);
  const command: ClientEnvelope = { protocolVersion: 1, commandId: 'cancel-hidden-ability', expectedRevision: before.revision,
    ...activeWindowRef(before.state.game!)!, command: { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: other.reactionTargetAbilityId! } };
  const reply = await room.command('B', command); expect(reply).toMatchObject({ type: 'ack' });
  const committed = await room.stored(); await room.restart();
  expect(await room.command('B', command)).toEqual(reply); expect(await room.stored()).toEqual(committed);
  for (let i = 0; i < 100; i++) {
    const stored = await room.stored(); const game = stored.state.game!; const w = game.windows?.at(-1);
    if (!w) break;
    const response = await room.command(w.participants[w.cursor]!, { protocolVersion: 1, commandId: `ability-pass-${i}`, expectedRevision: stored.revision,
      ...activeWindowRef(game)!, command: { type: 'PASS' } });
    expect(response).toMatchObject({ type: 'ack' });
  }
  const ended = await room.stored(); expect(ended.state.game!.windows).toHaveLength(0);
  expect(ended.state.game!.players.A).toMatchObject({ damage: 5, revealed: false });
  expect(ended.state.game!.players.A!.hand).toEqual(before.state.game!.players.A!.hand);
  expect(ended.state.game!.discard).toContain('a2-p07-r3c1');
  expect(ended.state.game!.discard).toContain('a2-p02-r2c3');
  expect(allCardInstanceIds(ended.state.game!)).toHaveLength(220);
  expect(new Set(allCardInstanceIds(ended.state.game!)).size).toBe(220);
  expect((await room.snapshotFor('A')).game!.abilityOptions).toEqual([]);
});
