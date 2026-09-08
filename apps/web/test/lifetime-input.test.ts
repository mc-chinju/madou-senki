import { expect, test } from 'vitest';
import { turnTechniqueCommand, turnTechniqueTargets, type LifetimeInputView } from '../src/game/lifetime-input.js';

function view(characterId = 'c2-p01-r1c2'): LifetimeInputView {
  return { self: { id: 'A', characterId, faction: 'GOOD', hand: ['a2-p12-r2c1', 'a2-p14-r3c1', 'a2-p13-r3c1'], chants: [] },
    seatOrder: ['A', 'B', 'C', 'D'], legalChoices: ['PLAY_TURN_TECHNIQUE'],
    distances: { A: { B: 'near', C: 'far', D: 'far' } },
    players: { A: { presence: 'active' }, B: { presence: 'active', characterId: 'c2-p05-r2c1' },
      C: { presence: 'dead', characterId: 'c2-p04-r1c2' }, D: { presence: 'dead', characterId: 'c2-p03-r1c2' } },
  } as unknown as LifetimeInputView;
}

test('Jill healing explicitly replaces self with a near living other target and rejects stale targets', () => {
  const v = view();
  expect(turnTechniqueTargets(v, 'a2-p14-r3c1', false)).toEqual(['A']);
  expect(turnTechniqueTargets(v, 'a2-p14-r3c1', true)).toEqual(['B']);
  expect(turnTechniqueCommand(v, 'a2-p14-r3c1', true, ['A'])).toBeNull();
  expect(turnTechniqueCommand(v, 'a2-p14-r3c1', true, ['B'])).toMatchObject({ type: 'PLAY_TURN_TECHNIQUE', targetIds: ['B'], dedicated: true });
  v.players.B!.presence = 'pending-death';
  expect(turnTechniqueCommand(v, 'a2-p14-r3c1', true, ['B'])).toBeNull();
});

test('ordinary resurrection needs a chanted source and one dead target', () => {
  const v = view();
  expect(turnTechniqueCommand(v, 'a2-p13-r3c1', false, ['C'])).toBeNull();
  v.self.hand = v.self.hand.filter(id => id !== 'a2-p13-r3c1');
  v.self.chants = [{ cardInstanceId: 'a2-p13-r3c1', revealed: false }];
  expect(turnTechniqueCommand(v, 'a2-p13-r3c1', false, ['C'])).toMatchObject({ targetIds: ['C'], dedicated: false });
  expect(turnTechniqueCommand(v, 'a2-p13-r3c1', false, ['C', 'D'])).toBeNull();
});

test('Uonos selects multiple dead targets and an explicit convertible subset without changing fixed allegiance', () => {
  const v = view('c2-p05-r1c1');
  expect(turnTechniqueCommand(v, 'a2-p13-r3c1', true, ['C', 'D'], ['C'])).toEqual({
    type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: 'a2-p13-r3c1', dedicated: true, targetIds: ['C', 'D'], convertTargetIds: ['C'],
  });
  expect(turnTechniqueCommand(v, 'a2-p13-r3c1', true, ['C', 'D'], ['D'])).toBeNull();
  expect(turnTechniqueCommand(v, 'a2-p13-r3c1', true, ['D'], ['C'])).toBeNull();
  expect(turnTechniqueCommand(v, 'a2-p13-r3c1', true, ['C'])).not.toHaveProperty('convertTargetIds');
  v.players.C!.characterId = 'c2-p06-r1c2';
  expect(turnTechniqueCommand(v, 'a2-p13-r3c1', true, ['C'], ['C'])).toBeNull();
  v.self.faction = 'EVIL';
  expect(turnTechniqueCommand(v, 'a2-p13-r3c1', true, ['C'], ['C'])).not.toBeNull();
  v.legalChoices = [];
  expect(turnTechniqueCommand(v, 'a2-p13-r3c1', true, ['C'])).toBeNull();
});
