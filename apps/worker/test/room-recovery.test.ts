import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, viewFor } from '@madou/engine';
import type { ClientEnvelope, GameCommand } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
async function envelope(room: Awaited<ReturnType<typeof openTestRoom>>, commandId: string, command: GameCommand): Promise<ClientEnvelope> {
  const current = await room.stored();
  return { protocolVersion: 1, commandId, expectedRevision: current.revision, ...activeWindowRef(current.state.game!)!, command };
}

it('restores an interrupted child with spent card, immediate OPEN/refill and no duplicate acceptance', async () => {
  const room = await openTestRoom('third-party-interrupt');
  const actionId = Object.keys(room.initial.actions!)[0]!;
  const request = await envelope(room, 'intervention', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel', targetActionId: actionId });
  const first = await room.command('C', request);
  expect(first.type).toBe('ack');
  const after = await room.stored();
  expect(after.state.game!.players.C!.hand).toHaveLength(5);
  expect(after.state.game!.players.C!.hand).not.toContain('a2-p02-r2c3');
  expect(after.state.game!.players.C!.open.length).toBe(room.initial.players.C!.open.length + 1);
  expect(after.state.game!.actions && Object.values(after.state.game!.actions).some(action => action.kind === 'reaction')).toBe(true);
  await room.restart();
  expect(await room.command('C', request)).toEqual(first);
  expect(await room.stored()).toEqual(after);
  const projected = await room.snapshotFor('A');
  expect(projected.game?.activeWindow?.windowId).toBe(activeWindowRef(after.state.game!)!.windowId);
  for (const card of after.state.game!.players.C!.hand) expect(JSON.stringify(projected)).not.toContain(card);
});

it('keeps a pending prayer roll and its exact result across eviction and command retry', async () => {
  const room = await openTestRoom('prayer-effect-level');
  const actionId = Object.keys(room.initial.actions!)[0]!;
  const request = await envelope(room, 'prayer', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p05-r2c3', mode: 'effect-plus', targetActionId: actionId });
  expect(await room.command('A', request)).toMatchObject({ type: 'ack' });
  let rollRequest: ClientEnvelope | undefined; let rollerCommandActor: string | undefined; let rollReply: unknown;
  for (let step = 0; step < 30; step++) {
    const current = await room.stored(); const game = viewFor(current.state.game!, 'A');
    if (game.currentRoll?.purpose === 'prayer-addition' && game.currentRoll.stage === 'after-roll') break;
    rollerCommandActor = game.activeWindow!.pendingActorId;
    rollRequest = await envelope(room, `prayer-pass-${step}`, { type: 'PASS' });
    rollReply = await room.command(rollerCommandActor, rollRequest);
    expect(rollReply).toMatchObject({ type: 'ack' });
  }
  const saved = await room.stored(); const roll = viewFor(saved.state.game!, 'A').currentRoll!;
  expect(roll).toMatchObject({ purpose: 'prayer-addition', stage: 'after-roll' });
  expect(roll.faces).toHaveLength(1); expect(roll.total).toBeGreaterThanOrEqual(1); expect(roll.total).toBeLessThanOrEqual(6);
  expect(rollRequest).toBeDefined(); expect(rollerCommandActor).toBeDefined();
  await room.restart();
  expect(await room.command(rollerCommandActor!, rollRequest!)).toEqual(rollReply);
  expect(await room.stored()).toEqual(saved);
  expect(new Set(allCardInstanceIds(saved.state.game!)).size).toBe(220);
});

it('restores a reroll declaration with immediate OPEN refill and does not spend or reroll on retry', async () => {
  const room = await openTestRoom('roll-check');
  const original = viewFor(room.initial, 'A').currentRoll!;
  const request = await envelope(room, 'reroll', { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r1c3', mode: 'reroll', targetRollId: original.rollId });
  const first = await room.command('A', request);
  expect(first).toMatchObject({ type: 'ack' });
  const saved = await room.stored(); const pending = viewFor(saved.state.game!, 'A');
  expect(pending.self.hand).not.toContain('a2-p02-r1c3');
  expect(pending.self.hand).toHaveLength(room.initial.players.A!.hand.length);
  expect(pending.players.A!.open.length).toBeGreaterThan(room.initial.players.A!.open.length);
  expect(pending.currentRoll).toMatchObject({ rollId: original.rollId, faces: [6, 6], generation: 0, threshold: 8 });
  expect(pending.activeWindow?.kind).toBe('declaration');
  await room.restart();
  expect(await room.command('A', request)).toEqual(first);
  expect(await room.stored()).toEqual(saved);
  const projected = await room.snapshotFor('B');
  // G03 判定の公開範囲: the outcome travels to every seat, the threshold only to a revealed one.
  expect(projected.game!.currentRoll!.threshold).toBeUndefined();
  expect(projected.game!.currentRoll!.success).toBe(false);
  for (const card of saved.state.game!.players.A!.hand) expect(JSON.stringify(projected)).not.toContain(card);
  expect(new Set(allCardInstanceIds(saved.state.game!)).size).toBe(220);
});

it('retains the follower boundary after eviction and rejects an otherwise owned defense', async () => {
  const room = await openTestRoom('follower-defense-started');
  expect(room.initial.windows?.at(-1)?.kind).toBe('follower-start');
  expect(room.initial.players.B!.hand).toContain('a2-p05-r3c1');
  await room.restart();
  const request = await envelope(room, 'too-late', { type: 'PLAY_DEFENSE', cardInstanceId: 'a2-p05-r3c1', dedicated: false });
  expect(await room.command('B', request)).toMatchObject({ type: 'error', code: 'INVALID_ACTION' });
  expect((await room.stored()).revision).toBe(0);
  expect((await room.stored()).state.game).toEqual(room.initial);
});

it('resumes shared multi-target hit progress and preserves simultaneous follower HP on every hit', async () => {
  const room = await openTestRoom('multi-target-multi-hit');
  const request = await envelope(room, 'first-defense', { type: 'PASS' });
  expect(await room.command('B', request)).toMatchObject({ type: 'ack', revision: 1 });
  const saved = await room.stored(); await room.restart();
  expect(await room.command('B', request)).toMatchObject({ type: 'ack', revision: 1 });
  expect(await room.stored()).toEqual(saved);
  for (let i = 0; i < 100; i++) {
    const current = await room.stored(); const window = current.state.game!.windows?.at(-1); if (!window) break;
    const actor=window.participants[window.cursor]!,command=await envelope(room, `pass-${i}`, { type: 'PASS' }),ack=await room.command(actor,command);expect(ack).toMatchObject({type:'ack'});
    const committed=await room.stored();await room.restart();expect(await room.command(actor,command)).toEqual(ack);expect(await room.stored()).toEqual(committed);
  }
  const ended = (await room.stored()).state.game!;
  expect(ended.windows).toEqual([]);
  expect(ended.players.B!.damage).toBe(18); expect(ended.players.C!.damage).toBe(21);
  expect(ended.players.B!.followers).toEqual([]);
  expect(new Set(allCardInstanceIds(ended)).size).toBe(220);
});
