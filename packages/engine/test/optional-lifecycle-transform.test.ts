import { expect, it } from 'vitest';
import { allCardInstanceIds, transition, viewFor, type GameCommand } from '../src/index.js';
import { entropy } from './fixtures.js';
import { makeLifecycleScenario } from '../../../apps/worker/test/fixtures/lifecycle-scenarios.js';
it.each([false, true])('G09 hidden Lancelot elects transformation %s only after explicit choice', use => {
  let state = makeLifecycleScenario('lifecycle-transform-hidden', ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const before = structuredClone(state), ability = 'c2-p02-r2c2-ab05';
  function send(actorId: string, command: GameCommand) {
    const input = { actorId, command }, random = entropy(), result = transition(state, input, random);
    expect(result).toEqual(transition(JSON.parse(JSON.stringify(state)), input, random));
    if (!result.ok) throw Error(result.code);
    state = result.state;
    expect(allCardInstanceIds(state)).toHaveLength(220);
    expect(new Set(allCardInstanceIds(state)).size).toBe(220);
  }
  function settle() {
    for (let n = 0; n < 200 && state.windows?.length; n++) {
      const w = state.windows.at(-1)!; send(w.participants[w.cursor]!, { type: 'PASS' });
    }
    expect(state.windows ?? []).toEqual([]);
  }
  send('B', { type: 'REVEAL_CHARACTER' }); settle();
  expect(state.players.A!.revealed).toBe(false);
  expect(viewFor(state, 'A').lifecycleAbilities).toContain('lancelot-transform');
  for (const actor of ['B', 'C', 'D']) {
    expect(viewFor(state, actor).players.A).not.toHaveProperty('characterId');
    expect(viewFor(state, actor).lifecycleAbilities).not.toContain('lancelot-transform');
  }
  if (use) { send('A', { type: 'USE_LIFECYCLE_ABILITY', ability: 'lancelot-transform' }); settle(); }
  else {
    send('A', { type: 'PASS_ACTION' });
    const excess = Math.max(0, state.players.A!.hand.length - viewFor(state, 'A').self.stats.handLimit);
    send('A', { type: 'END_TURN', discardIds: state.players.A!.hand.slice(0, excess) });
  }
  expect(state.players.A!.characterId).toBe(use ? 'c2-p07-r1c1' : 'c2-p02-r2c2');
  expect(state.players.A!.revealed).toBe(use);
  expect(state.used?.filter(key => key.includes(ability)) ?? []).toHaveLength(use ? 1 : 0);
  if (!use) {
    expect(state.used).toEqual(before.used);
    expect(state.abilities).toEqual(before.abilities);
    for (const actor of ['B', 'C', 'D']) expect(viewFor(state, actor).players.A).not.toHaveProperty('characterId');
  }
});
