import { expect, test } from 'vitest';
import { attackWithCosts, techniqueDecisionCommand, groupDefenseCommand, type CombinationInputView } from '../src/game/combination-input.js';

const beast = 'a2-p09-r1c1';
const component = 'a2-p08-r1c1';
const voidSword = 'a2-p09-r2c1';
const advance = 'a2-p23-r1c2';
function input(): CombinationInputView {
  return {
    self: { id: 'A', hand: [beast, component, voidSword, advance], chants: [] },
    legalChoices: ['ATTACK'], activeWindow: null,
    combinationOptions: [{ cardInstanceId: beast, coSources: [{ cardInstanceId: component, dedicated: false }] }],
    advanceCostOptions: [{ cardInstanceId: voidSword, advanceCardInstanceIds: [advance] }],
    techniqueDecision: null, groupDefenseOptions: [],
  };
}
test('combination accepts only the exact own projected co-source and preserves both declaration identities', () => {
  const base = { type: 'ATTACK' as const, cardInstanceId: beast, targetIds: ['B'], dedicated: true };
  expect(attackWithCosts(input(), base, { cardInstanceId: component, dedicated: false }, [])).toEqual({ ...base, coSource: { cardInstanceId: component, dedicated: false } });
  expect(attackWithCosts(input(), base, { cardInstanceId: component, dedicated: true }, [])).toBeNull();
  expect(attackWithCosts(input(), base, { cardInstanceId: beast, dedicated: false }, [])).toBeNull();
  expect(attackWithCosts(input(), { ...base, dedicated: false }, { cardInstanceId: component, dedicated: false }, [])).toBeNull();
  expect(attackWithCosts({ ...input(), self: { ...input().self, hand: [beast] } }, base, { cardInstanceId: component, dedicated: false }, [])).toBeNull();
  expect(attackWithCosts(input(), base, undefined, [])).toEqual(base);
});
test('advance costs are an explicit unique owned batch and cannot also be the physical attack source', () => {
  const base = { type: 'ATTACK' as const, cardInstanceId: voidSword, targetIds: ['B'], dedicated: true };
  expect(attackWithCosts(input(), base, undefined, [advance])).toEqual({ ...base, advanceCardInstanceIds: [advance] });
  for (const costs of [[advance, advance], [voidSword], [component]]) expect(attackWithCosts(input(), base, undefined, costs)).toBeNull();
  expect(attackWithCosts(input(), { ...base, dedicated: false }, undefined, [advance])).toBeNull();
  expect(attackWithCosts({ ...input(), legalChoices: [] }, base, undefined, [advance])).toBeNull();
});
test('post-hit payment and optional double check require the current private saved decision', () => {
  const view: CombinationInputView = { ...input(), legalChoices: ['PAY_HIT_ADVANCES', 'PASS'], activeWindow: { pendingActorId: 'A' }, techniqueDecision: { kind: 'hit-advance', actorId: 'A', groupId: 'g3', sourceCardInstanceId: 'a2-p08-r1c2', cardInstanceIds: [advance] } };
  expect(techniqueDecisionCommand(view, [advance])).toEqual({ type: 'PAY_HIT_ADVANCES', groupId: 'g3', cardInstanceIds: [advance] });
  expect(techniqueDecisionCommand(view, [])).toEqual({ type: 'PAY_HIT_ADVANCES', groupId: 'g3', cardInstanceIds: [] });
  expect(techniqueDecisionCommand(view, [component])).toBeNull();
  expect(techniqueDecisionCommand({ ...view, activeWindow: { pendingActorId: 'B' } }, [advance])).toBeNull();
  const double = { ...view, legalChoices: ['CHOOSE_DAMAGE_DOUBLE'], techniqueDecision: { kind: 'damage-double' as const, actorId: 'A', actionId: 'x9', sourceCardInstanceId: 'a2-p09-r1c3' } };
  expect(techniqueDecisionCommand(double, [], true)).toEqual({ type: 'CHOOSE_DAMAGE_DOUBLE', actionId: 'x9', attempt: true });
  expect(techniqueDecisionCommand(double, [], false)).toEqual({ type: 'CHOOSE_DAMAGE_DOUBLE', actionId: 'x9', attempt: false });
});
test('Lia group defense binds only the offered group and source, without sending mutable target selections', () => {
  const cardInstanceId = 'a2-p16-r3c3';
  const view = { ...input(), self: { ...input().self, hand: [cardInstanceId] }, legalChoices: ['PLAY_GROUP_DEFENSE'], activeWindow: { pendingActorId: 'A' }, groupDefenseOptions: [{ cardInstanceId, groupId: 'g4', targetIds: ['B', 'C'] }] };
  expect(groupDefenseCommand(view, cardInstanceId, 'g4')).toEqual({ type: 'PLAY_GROUP_DEFENSE', cardInstanceId, groupId: 'g4', dedicated: true });
  expect(groupDefenseCommand(view, cardInstanceId, 'old')).toBeNull();
  expect(groupDefenseCommand({ ...view, groupDefenseOptions: [] }, cardInstanceId, 'g4')).toBeNull();
});

test('combined defense requires an explicit projected counter source at the own normal-defense window', async () => {
  const { combinationDefenseCommand } = await import('../src/game/combination-input.js');
  const source = { cardInstanceId: 'a2-p08-r2c3', dedicated: false };
  const view = { ...input(), self: { ...input().self, hand: [beast, source.cardInstanceId] }, legalChoices: ['PLAY_DEFENSE'], activeWindow: { kind: 'normal-defense', pendingActorId: 'A' }, combinationOptions: [{ cardInstanceId: beast, coSources: [source] }] };
  expect(combinationDefenseCommand(view, source)).toEqual({ type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: source });
  expect(combinationDefenseCommand(view, undefined)).toBeNull();
  expect(combinationDefenseCommand({ ...view, activeWindow: { kind: 'normal-defense', pendingActorId: 'B' } }, source)).toBeNull();
  expect(combinationDefenseCommand(view, { cardInstanceId: component, dedicated: false })).toBeNull();
});

test('new fixed defenses omit publicly impossible leaf and faction-restricted light choices', async () => {
  const { eligibleReactionCards } = await import('../src/game/commands.js');
  const cards = ['a2-p13-r2c2', 'a2-p16-r3c3', 'a2-p08-r3c2'];
  expect(eligibleReactionCards('PLAY_DEFENSE', cards, [], 'cancel', { incomingAttributes: ['魔', '炎'], faction: 'EVIL' })).toEqual(['a2-p08-r3c2']);
  expect(eligibleReactionCards('PLAY_DEFENSE', cards, [], 'cancel', { incomingAttributes: ['戦', '風'], faction: 'GOOD' })).toEqual(['a2-p16-r3c3', 'a2-p08-r3c2']);
  expect(eligibleReactionCards('PLAY_DEFENSE', cards, [], 'cancel', { incomingAttributes: ['戦', '剣'], faction: 'GOOD' })).toEqual(cards);
});
