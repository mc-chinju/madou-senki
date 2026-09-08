import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds } from '@madou/engine';
import type { ClientEnvelope } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
it('restores both composite reservations and replays cancellation once without refund or hidden ownership leakage', async () => {
  const room = await openTestRoom('combination-cancel');
  const before = await room.stored();
  const own = (await room.snapshotFor('A')).game!;
  const other = (await room.snapshotFor('B')).game!;
  expect(own.currentAction?.source).toBe('card');
  if (own.currentAction?.source !== 'card') throw Error('EXPECTED_CARD');
  const primary = own.currentAction.cardInstanceId;
  const component = own.currentAction.coSourceCardInstanceId!;
  expect(primary).toBe('a2-p09-r1c1'); expect(component).toBeTruthy();
  expect(own.self.hand).not.toContain(primary); expect(own.self.hand).not.toContain(component);
  expect(other.currentAction).toEqual(own.currentAction);
  expect(other.combinationOptions).toEqual([]);
  expect(JSON.stringify(other)).not.toContain(own.self.characterId);
  await room.restart(); expect(await room.stored()).toEqual(before);
  const envelope: ClientEnvelope = { protocolVersion: 1, commandId: 'composite-cancel', expectedRevision: before.revision,
    ...activeWindowRef(before.state.game!)!, command: { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel', targetActionId: other.reactionTargetActionId! } };
  const ack = await room.command('B', envelope); expect(ack).toMatchObject({ type: 'ack' });
  const committed = await room.stored(); await room.restart();
  expect(await room.command('B', envelope)).toEqual(ack); expect(await room.stored()).toEqual(committed);
  for (let step = 0; step < 100; step++) {
    const saved = await room.stored(); const game = saved.state.game!; const window = game.windows?.at(-1);
    if (!window) break;
    expect(await room.command(window.participants[window.cursor]!, { protocolVersion: 1, commandId: `composite-pass-${step}`, expectedRevision: saved.revision,
      ...activeWindowRef(game)!, command: { type: 'PASS' } })).toMatchObject({ type: 'ack' });
  }
  const game = (await room.stored()).state.game!;
  expect(game.windows).toHaveLength(0); expect(game.players.B!.damage).toBe(0);
  expect(game.discard.filter(id => id === primary)).toHaveLength(1);
  expect(game.discard.filter(id => id === component)).toHaveLength(1);
  expect(game.players.A!.hand).toEqual(before.state.game!.players.A!.hand);
  expect(allCardInstanceIds(game)).toHaveLength(220); expect(new Set(allCardInstanceIds(game)).size).toBe(220);
});

it('restores private printed-grant candidates and consumes the chosen additional attack once after a lost acknowledgment', async () => {
  const room = await openTestRoom('combination-shadow');
  let sequence = 0;
  async function submit(actorId: string, command: ClientEnvelope['command']) {
    const saved = await room.stored();
    const envelope: ClientEnvelope = {
      protocolVersion: 1, commandId: `printed-grant-${sequence++}`, expectedRevision: saved.revision,
      ...activeWindowRef(saved.state.game!)!, command,
    };
    const ack = await room.command(actorId, envelope);
    expect(ack).toMatchObject({ type: 'ack' });
    return { envelope, ack };
  }
  await submit('B', { type: 'PLAY_DEFENSE', cardInstanceId: 'a2-p08-r3c2', dedicated: true });
  for (let step = 0; step < 100; step++) {
    const window = (await room.stored()).state.game!.windows?.at(-1);
    if (window?.kind === 'ability-attack') break;
    if (!window) throw Error('PRINTED_GRANT_NOT_REACHED');
    await submit(window.participants[window.cursor]!, { type: 'PASS' });
  }
  const own = (await room.snapshotFor('B')).game!;
  expect(own.additionalAttack).toMatchObject({ source: 'card', actorId: 'B', targetId: 'A', sourceCardInstanceId: 'a2-p08-r3c2' });
  const chosen = own.additionalAttackOptions.find(option => option.cardInstanceId === 'a2-p08-r1c1' && !option.dedicated);
  expect(chosen).toEqual({ cardInstanceId: 'a2-p08-r1c1', dedicated: false });
  const observer = (await room.snapshotFor('A')).game!;
  expect(observer.additionalAttackOptions).toEqual([]);
  for (const hiddenId of own.self.hand) expect(JSON.stringify(observer)).not.toContain(hiddenId);
  const before = await room.stored();
  await room.restart();
  expect(await room.stored()).toEqual(before);
  expect((await room.snapshotFor('B')).game!.additionalAttackOptions).toEqual(own.additionalAttackOptions);
  const { envelope, ack } = await submit('B', { type: 'ATTACK', ...chosen!, targetIds: ['A'] });
  const committed = await room.stored();
  expect(committed.state.game!.players.B!.hand).not.toContain('a2-p08-r1c1');
  await room.restart();
  expect(await room.command('B', envelope)).toEqual(ack);
  expect(await room.stored()).toEqual(committed);
  expect((await room.snapshotFor('B')).game!.additionalAttackOptions).toEqual([]);
  const ids = allCardInstanceIds(committed.state.game!);
  expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
});
