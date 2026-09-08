import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds, transition, viewFor, type GameCommand } from '@madou/engine';
import type { ClientEnvelope } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';
import { followerAttackScenarioNames, makeFollowerAttackScenario } from './fixtures/follower-attack-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';

afterEach(async () => { await reset(); });
it.each(followerAttackScenarioNames)('resolves %s through real follower attack commands', name => {
  let game = makeFollowerAttackScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const result = transition(game, input, entropy());
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, entropy())).toEqual(result); game = result.state;
    expect(allCardInstanceIds(game)).toHaveLength(220); expect(new Set(allCardInstanceIds(game)).size).toBe(220);
  }
  if (!game.windows?.length) {
    if (name === 'follower-attack-beast') act('A', { type: 'ATTACK', cardInstanceId: 'a2-p09-r1c1', dedicated: true, targetIds: ['B', 'D'], coSource: { cardInstanceId: 'a2-p20-r3c1', dedicated: true } });
    else {
      const option = viewFor(game, 'A').followerAttackOptions[0]!;
      expect(option).toBeTruthy();
      act('A', { type: 'ATTACK', cardInstanceId: option.cardInstanceId, dedicated: true, targetIds: option.targetMode === 'mandatory-all' ? option.legalTargetIds : ['B'] });
    }
  }
  for (let step = 0; step < 250 && game.windows?.length; step++) {
    const window = game.windows.at(-1)!; act(window.participants[window.cursor]!, { type: 'PASS' });
  }
  expect(game.windows).toHaveLength(0); expect(game.players.A!.followers).toHaveLength(0);
  expect(game.players.B!.damage).toBeGreaterThan(0);
});
it('reserves the placed source once and restores private eligibility and its paid origin after eviction', async () => {
  const room = await openTestRoom('follower-attack-royal'); const before = await room.stored();
  const own = (await room.snapshotFor('A')).game!;
  const source = own.followerAttackOptions.find(option => option.cardInstanceId === 'a2-p21-r1c2')!;
  expect(source).toMatchObject({ sourceZone: 'followers', dedicated: true, targetMode: 'one' });
  const other = (await room.snapshotFor('B')).game!;
  expect(other.followerAttackOptions).toEqual([]); expect(JSON.stringify(other)).not.toContain(source.cardInstanceId);
  await room.restart(); expect((await room.snapshotFor('A')).game!.followerAttackOptions).toEqual(own.followerAttackOptions);
  const envelope: ClientEnvelope = { protocolVersion: 1, commandId: 'placed-follower-attack', expectedRevision: before.revision,
    ...activeWindowRef(before.state.game!), command: { type: 'ATTACK', cardInstanceId: source.cardInstanceId, dedicated: true, targetIds: ['B'] } };
  const ack = await room.command('A', envelope); expect(ack).toMatchObject({ type: 'ack' });
  const committed = await room.stored();
  expect(committed.state.game!.players.A!.followers).toEqual([]);
  expect(committed.state.game!.resolution.filter(id => id === source.cardInstanceId)).toHaveLength(1);
  expect((await room.snapshotFor('A')).game!.currentAction).toMatchObject({ source: 'card', sourceZone: 'followers', cardInstanceId: source.cardInstanceId });
  await room.restart(); expect(await room.command('A', envelope)).toEqual(ack); expect(await room.stored()).toEqual(committed);
  expect(allCardInstanceIds(committed.state.game!)).toHaveLength(220); expect(new Set(allCardInstanceIds(committed.state.game!)).size).toBe(220);
});
