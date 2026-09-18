import { expect, it } from 'vitest';
import { allCardInstanceIds, transition, viewFor, type GameCommand } from '../src/index.js';
import { entropy } from './fixtures.js';
import { makeTurnInformationScenario } from './fixtures/turn-information-scenarios.js';

it.each([
  ['info-cham-followers', 'c2-p01-r2c2-ab03'], ['info-lia-chants', 'c2-p03-r1c2-ab02'],
  ['info-lester-rumor', 'c2-p03-r2c1-ab03'], ['info-alseil-hand', 'c2-p04-r2c1-ab02'],
  ['info-lancaster-discard', 'c2-p02-r2c1-ab04'], ['info-aiel-twins', 'c2-p04-r1c1-ab04'],
  ['info-flaiard-twins', 'c2-p06-r2c1-ab04'], ['info-alseil-shadow', 'c2-p04-r2c1-ab01'],
  ['info-uonos-reveal', 'c2-p05-r1c1-ab01'],
] as const)('G09 %s can end the turn without using %s or exposing unchosen information', (scenario, abilityId) => {
  let state = makeTurnInformationScenario(scenario, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const before = structuredClone(state);
  expect(viewFor(state, 'A').abilityOptions.some(option => option.abilityId === abilityId)).toBe(true);
  function privacy() {
    for (const actor of ['B', 'C', 'D']) {
      const view = viewFor(state, actor);
      expect(view.abilityOptions.some(option => option.abilityId === abilityId)).toBe(false);
      expect(view.inspection).toBeNull();
      if (!before.players.A!.revealed) expect(view.players.A).not.toHaveProperty('characterId');
    }
  }
  function send(command: GameCommand) {
    const input = { actorId: 'A', command }, random = entropy(), result = transition(state, input, random);
    expect(result).toEqual(transition(JSON.parse(JSON.stringify(state)), input, random));
    if (!result.ok) throw Error(result.code);
    state = result.state;
    expect(allCardInstanceIds(state)).toHaveLength(220);
    expect(new Set(allCardInstanceIds(state)).size).toBe(220);
    privacy();
  }
  privacy();
  send({ type: 'PASS_ACTION' });
  expect(state.players).toEqual(before.players);
  const excess = Math.max(0, state.players.A!.hand.length - viewFor(state, 'A').self.stats.handLimit);
  const discardIds = state.players.A!.hand.slice(0, excess);
  send({ type: 'END_TURN', discardIds });
  expect(state.phase).toBe('turn-start');
  expect(state.seatOrder[state.turnSeat]).toBe('B');
  expect(state.used).toEqual(before.used);
  expect(state.abilities).toEqual(before.abilities);
  expect(state.inspections ?? []).toEqual(before.inspections ?? []);
  for (const actor of ['B', 'C', 'D']) expect(state.players[actor]).toEqual(before.players[actor]);
  expect(state.players.A!.revealed).toBe(before.players.A!.revealed);
  expect(state.players.A!.hand).toEqual(before.players.A!.hand.filter(id => !discardIds.includes(id)));
});
