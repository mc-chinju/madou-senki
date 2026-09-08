import { techniqueFor } from '../../../packages/engine/src/effects/registry.js';
import { expect, test } from 'vitest';
import { magicGateCommand, type MagicGateInputView } from '../src/game/magic-gate-input.js';

function input(): MagicGateInputView {
  return { self: { id: 'A', hand: ['a2-p17-r3c3'], followers: [{ cardInstanceId: 'a2-p21-r2c1' }, { cardInstanceId: 'a2-p18-r3c1' }], stats: { followerLimit: 2 } },
    activeWindow: null, legalChoices: ['PLAY_TURN_TECHNIQUE'], followerDefenseOptions: [],
    followerPlacementOptions: { placeableCardInstanceIds: [], removableCardInstanceIds: ['a2-p18-r3c1'] }, magicGateTargets: [{ actorId: 'B', positions: [0, 1] }] };
}
test('Magic Gate selects a public donor position and explicit owned replacement without sending a hidden source ID', () => {
  expect(magicGateCommand(input(), 'B', 1, 0, 'a2-p18-r3c1')).toEqual({ type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: 'a2-p17-r3c3', targetIds: ['B'], dedicated: false,
    followerTransfer: { targetPosition: 1, destinationPosition: 0, replacementCardInstanceId: 'a2-p18-r3c1' } });
  expect(magicGateCommand(input(), 'B', 1, 0)).toBeNull();
  expect(magicGateCommand(input(), 'B', 1, 0, 'a2-p21-r2c1')).toBeNull();
  expect(magicGateCommand(input(), 'B', 1, 0, 'foreign')).toBeNull();
});
test('Magic Gate keeps all offered hidden positions selectable and rejects stale or invalid positions and priority', () => {
  const view = input();
  expect(magicGateCommand(view, 'B', 0, 1, 'a2-p18-r3c1')).not.toBeNull();
  for (const [target, destination] of [[2, 0], [0.5, 0], [0, -1], [0, 2]]) expect(magicGateCommand(view, 'B', target!, destination!, 'a2-p18-r3c1')).toBeNull();
  expect(magicGateCommand(view, 'A', 0, 0, 'a2-p18-r3c1')).toBeNull();
  expect(magicGateCommand({ ...view, magicGateTargets: [] }, 'B', 0, 0, 'a2-p18-r3c1')).toBeNull();
  expect(magicGateCommand({ ...view, activeWindow: { kind: 'declaration', pendingActorId: 'A' } }, 'B', 0, 0, 'a2-p18-r3c1')).toBeNull();
  expect(magicGateCommand({ ...view, self: { ...view.self, hand: [] } }, 'B', 0, 0, 'a2-p18-r3c1')).toBeNull();
});
test('Magic Gate uses effective capacity, requires no sacrifice when a slot is free, and preserves insertion choices', () => {
  const view = input(); view.self.stats.followerLimit = 3;
  expect(magicGateCommand(view, 'B', 0, 2)).toEqual({ type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: 'a2-p17-r3c3', targetIds: ['B'], dedicated: false, followerTransfer: { targetPosition: 0, destinationPosition: 2 } });
  expect(magicGateCommand(view, 'B', 0, 0, 'a2-p18-r3c1')).toBeNull();
  expect(magicGateCommand(view, 'B', 0, 3)).toBeNull();
});

test('Magic Gate preserves explicit declaration abilities and all transfer choices', () => {
  const view = input();
  const candidate = { kind: 'turn-technique' as const, choice: { cardInstanceId: 'a2-p17-r3c3', dedicated: false },
    sourceZone: 'hand' as const, fromChant: false, technique: techniqueFor('a2-p17-r3c3')!, targetIds: [], nearTargetIds: [],
    abilities: [{ abilityId: 'c2-p01-r1c1-ab03', name: '大魔術師', effects: { waiveChant: true } }] };
  const withAbilities = { ...view, declarationCandidates: [candidate] };
  expect(magicGateCommand(withAbilities, 'B', 1, 0, 'a2-p18-r3c1', ['c2-p01-r1c1-ab03'])).toEqual({
    ...magicGateCommand(view, 'B', 1, 0, 'a2-p18-r3c1'), declarationAbilityIds: ['c2-p01-r1c1-ab03'],
  });
  expect(magicGateCommand(withAbilities, 'B', 1, 0, 'a2-p18-r3c1', ['foreign'])).toBeNull();
});
