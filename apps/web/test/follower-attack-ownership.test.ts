import { expect, test } from 'vitest';
import { attackWithCosts, type CombinationInputView } from '../src/game/combination-input.js';
import { grantedAttackCommand, grantedAttackSources, type AbilityInputView } from '../src/game/ability-input.js';

const griffin = 'a2-p20-r3c1';
const beast = 'a2-p09-r1c1';
test('Beast accepts only its exact offered own placed follower component', () => {
  const source = { cardInstanceId: griffin, dedicated: true };
  const view = {
    self: { id: 'A', hand: [beast], chants: [], followers: [{ cardInstanceId: griffin }] },
    legalChoices: ['ATTACK'], activeWindow: null,
    combinationOptions: [{ cardInstanceId: beast, coSources: [source] }],
    advanceCostOptions: [], techniqueDecision: null, groupDefenseOptions: [],
  } satisfies CombinationInputView;
  const base = { type: 'ATTACK' as const, cardInstanceId: beast, targetIds: ['B'], dedicated: true };
  expect(attackWithCosts(view, base, source, [])).toEqual({ ...base, coSource: source });
  expect(attackWithCosts({ ...view, self: { ...view.self, followers: [] } }, base, source, [])).toBeNull();
  expect(attackWithCosts({ ...view, combinationOptions: [] }, base, source, [])).toBeNull();
  expect(attackWithCosts(view, base, { ...source, dedicated: false }, [])).toBeNull();
});

test('fixed-target additional attacks include only exact offered placed sources and preserve explicit dedication', () => {
  const view = {
    self: { id: 'A', hand: [], chants: [], followers: [{ cardInstanceId: griffin }] },
    legalChoices: ['ATTACK', 'PASS'], activeWindow: { kind: 'ability-attack', pendingActorId: 'A' },
    currentAction: null, abilityOptions: [], advanceCostOptions: [],
    additionalAttack: { source: 'ability' as const, actorId: 'A', targetId: 'B' },
    additionalAttackOptions: [{ cardInstanceId: griffin, dedicated: true }], players: { A: { presence: 'active' }, B: { presence: 'active' } },
  } satisfies AbilityInputView;
  expect(grantedAttackSources(view)).toEqual([griffin]);
  expect(grantedAttackCommand(view, griffin, true)).toEqual({ type: 'ATTACK', cardInstanceId: griffin, dedicated: true, targetIds: ['B'] });
  expect(grantedAttackCommand(view, griffin, false)).toBeNull();
  expect(grantedAttackCommand({ ...view, additionalAttackOptions: [] }, griffin, true)).toBeNull();
  expect(grantedAttackCommand({ ...view, self: { ...view.self, followers: [] } }, griffin, true)).toBeNull();
  expect(grantedAttackCommand({ ...view, activeWindow: { ...view.activeWindow, pendingActorId: 'B' } }, griffin, true)).toBeNull();
});
