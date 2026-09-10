import { expect, it } from 'vitest';
import { allCardInstanceIds, transition, viewFor, type GameCommand } from '../src/index.js';
import { entropy } from './fixtures.js';
import { makeSuppressionScenario } from '../../../apps/worker/test/fixtures/suppression-scenarios.js';
import { makeFollowerAttackScenario } from '../../../apps/worker/test/fixtures/follower-attack-scenarios.js';
it.each(['suppression-hidden-ordinary', 'follower-attack-griffin'] as const)('G09 %s remains unelected through actual turn end', scenario => {
  const players = ['A', 'B', 'C', 'D'].map(id => ({ id, name: id }));
  let state = scenario === 'suppression-hidden-ordinary' ? makeSuppressionScenario(scenario, players) : makeFollowerAttackScenario(scenario, players);
  const before = structuredClone(state), own = viewFor(state, 'A');
  if (scenario === 'suppression-hidden-ordinary') expect(own.abilityOptions.some(o => o.abilityId === 'c2-p07-r1c2-ab03')).toBe(true);
  else expect(own.followerBundleOptions.some(o => o.abilityId === 'c2-p05-r1c2-ab02')).toBe(true);
  function privacy() {
    for (const actor of ['B', 'C', 'D']) {
      const view = viewFor(state, actor);
      expect(view.followerBundleOptions).toEqual([]);
      expect(view.abilityOptions.some(o => o.abilityId === 'c2-p07-r1c2-ab03')).toBe(false);
      if (!before.players.A!.revealed) expect(view.players.A).not.toHaveProperty('characterId');
    }
  }
  function send(command: GameCommand) {
    const input = { actorId: 'A', command }, random = entropy(), result = transition(state, input, random);
    expect(result).toEqual(transition(JSON.parse(JSON.stringify(state)), input, random));
    if (!result.ok) throw Error(result.code);
    state = result.state; privacy();
    expect(allCardInstanceIds(state)).toHaveLength(220); expect(new Set(allCardInstanceIds(state)).size).toBe(220);
  }
  privacy();
  if (state.phase === 'action') send({ type: 'PASS_ACTION' });
  const excess = Math.max(0, state.players.A!.hand.length - viewFor(state, 'A').self.stats.handLimit);
  const discardIds = state.players.A!.hand.slice(0, excess);
  send({ type: 'END_TURN', discardIds });
  expect(state.phase).toBe('turn-start'); expect(state.turnSeat).toBe(1);
  expect(state.used).toEqual(before.used); expect(state.abilities).toEqual(before.abilities);
  expect(state.followerBundles).toEqual(before.followerBundles);
  expect(state.suppressionDesignations).toEqual(before.suppressionDesignations);
  expect(state.blessingLeases).toEqual(before.blessingLeases);
  expect(state.players.A!.followers).toEqual(before.players.A!.followers);
  const retained = before.players.A!.hand.filter(id => !discardIds.includes(id));
  const refill = Math.max(0, own.self.stats.handLimit - retained.length);
  expect(state.players.A!.hand).toEqual([...retained, ...before.deck.slice(0, refill)]);
  expect(state.deck).toEqual(before.deck.slice(refill));
  for (const actor of ['B', 'C', 'D']) expect(state.players[actor]).toEqual(before.players[actor]);
});
