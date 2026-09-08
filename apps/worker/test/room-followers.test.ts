import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition } from '@madou/engine';
import type { ClientEnvelope } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';
import { followerScenarioNames, makeFollowerScenario } from './fixtures/follower-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';

afterEach(async () => { await reset(); });
it.each(followerScenarioNames)('builds and resumes the actual %s fixture with all physical cards intact', name => {
  let game = makeFollowerScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  for (let step = 0; step < 200 && game.windows?.length; step++) {
    const window = game.windows.at(-1)!;
    const result = transition(game, { actorId: window.participants[window.cursor]!, command: { type: 'PASS' } }, entropy());
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code); game = result.state;
  }
  expect(game.windows ?? []).toHaveLength(0);
  expect(allCardInstanceIds(game)).toHaveLength(220); expect(new Set(allCardInstanceIds(game)).size).toBe(220);
});
it('restores a privately bound Gate target and replays cancellation once without refund or revealing it', async () => {
  const room = await openTestRoom('magic-gate-cancel');
  const before = await room.stored();
  const target = before.state.game!.players.B!.followers[0]!.cardInstanceId;
  const replacement = 'a2-p18-r3c1';
  for (const actor of ['A', 'C', 'D']) {
    const view = (await room.snapshotFor(actor)).game!;
    expect(JSON.stringify(view)).not.toContain(target);
    expect(view.magicGateTargets).toEqual([]);
  }
  expect(before.state.game!.discard).toContain(replacement);
  await room.restart(); expect(await room.stored()).toEqual(before);
  const defender = (await room.snapshotFor('B')).game!;
  const envelope: ClientEnvelope = { protocolVersion: 1, commandId: 'gate-cancel', expectedRevision: before.revision,
    ...activeWindowRef(before.state.game!)!, command: { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel', targetActionId: defender.reactionTargetActionId! } };
  const ack = await room.command('B', envelope); expect(ack).toMatchObject({ type: 'ack' });
  const committed = await room.stored(); await room.restart();
  expect(await room.command('B', envelope)).toEqual(ack); expect(await room.stored()).toEqual(committed);
  for (let step = 0; step < 100; step++) {
    const saved = await room.stored(); const game = saved.state.game!; const window = game.windows?.at(-1);
    if (!window) break;
    expect(await room.command(window.participants[window.cursor]!, { protocolVersion: 1, commandId: `gate-pass-${step}`, expectedRevision: saved.revision,
      ...activeWindowRef(game)!, command: { type: 'PASS' } })).toMatchObject({ type: 'ack' });
  }
  const game = (await room.stored()).state.game!;
  expect(game.windows).toHaveLength(0); expect(game.players.A!.followers).toHaveLength(1);
  expect(game.players.B!.followers[0]).toEqual({ cardInstanceId: target, revealed: false });
  expect(game.players.A!.hand).not.toContain('a2-p17-r3c3'); expect(game.players.A!.hand).not.toContain(replacement);
  for (const actor of ['A', 'C', 'D']) expect(JSON.stringify((await room.snapshotFor(actor)).game)).not.toContain(target);
  expect(allCardInstanceIds(game)).toHaveLength(220); expect(new Set(allCardInstanceIds(game)).size).toBe(220);
});
