import { expect, test } from 'vitest';
import { abilityCommand, grantedAttackCommand, selectableAbilities, type AbilityInputView } from '../src/game/ability-input.js';

const hide = { abilityId: 'c2-p04-r2c2-ab04', name: '隠行', targetEventId: 'turn-4', costCardInstanceIds: ['a2-p07-r3c1'], canConceal: true };
function input(): AbilityInputView {
  return { self: { id: 'A', hand: ['a2-p07-r3c1', 'a2-p08-r1c1'], chants: [] }, abilityOptions: [hide], legalChoices: ['USE_ABILITY'],
    activeWindow: null, currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [], players: { A: { presence: 'active' }, B: { presence: 'active' } } };
}
test('ability inputs require the exact private offered event and an explicitly selected owned cost', () => {
  const view = input();
  expect(abilityCommand(view, hide.abilityId)).toBeNull();
  expect(abilityCommand(view, hide.abilityId, 'a2-p08-r1c1', true)).toBeNull();
  expect(abilityCommand(view, hide.abilityId, 'a2-p07-r3c1', true)).toEqual({ type: 'USE_ABILITY', abilityId: hide.abilityId, targetEventId: 'turn-4', costCardInstanceId: 'a2-p07-r3c1', conceal: true });
  expect(abilityCommand({ ...view, self: { ...view.self, hand: [] } }, hide.abilityId, 'a2-p07-r3c1')).toBeNull();
  expect(abilityCommand({ ...view, legalChoices: [] }, hide.abilityId, 'a2-p07-r3c1')).toBeNull();
});
test('uncosted ability selection sends no invented cost or concealment and cannot use another identity', () => {
  const view = { ...input(), abilityOptions: [{ abilityId: 'c2-p04-r2c2-ab03', name: '必殺', targetEventId: 'hit-4' }] };
  expect(abilityCommand(view, 'c2-p04-r2c2-ab03')).toEqual({ type: 'USE_ABILITY', abilityId: 'c2-p04-r2c2-ab03', targetEventId: 'hit-4' });
  expect(abilityCommand(view, hide.abilityId)).toBeNull();
});
test('targeted turn abilities require one currently offered target and untargeted abilities reject one', () => {
  const option = { abilityId: 'c2-p03-r2c1-ab03', name: '噂', targetEventId: 'turn-8', targetIds: ['B'], actionCost: 'extra' as const };
  const view = { ...input(), abilityOptions: [option] };
  expect(abilityCommand(view, option.abilityId)).toBeNull();
  expect(abilityCommand(view, option.abilityId, undefined, false, [], 'C')).toBeNull();
  expect(abilityCommand(view, option.abilityId, undefined, false, [], 'B')).toEqual({ type: 'USE_ABILITY', abilityId: option.abilityId, targetEventId: 'turn-8', targetId: 'B' });
  expect(abilityCommand({ ...view, abilityOptions: [{ ...option, targetIds: [] }] }, option.abilityId, undefined, false, [], 'B')).toBeNull();
  expect(abilityCommand(input(), hide.abilityId, 'a2-p07-r3c1', false, [], 'B')).toBeNull();
});
test('granted attack fixes its target to the resolved ability enemy and rejects stale or nonowned sources', () => {
  const view: AbilityInputView = { ...input(), legalChoices: ['ATTACK', 'PASS'], activeWindow: { kind: 'ability-attack', pendingActorId: 'A' },
    currentAction: { source: 'ability', actorId: 'A', targetIds: ['B'] }, additionalAttack: { source: 'ability', actorId: 'A', targetId: 'B' },
    additionalAttackOptions: [{ cardInstanceId: 'a2-p08-r1c1', dedicated: false }] };
  expect(grantedAttackCommand(view, 'a2-p08-r1c1', false)).toEqual({ type: 'ATTACK', cardInstanceId: 'a2-p08-r1c1', targetIds: ['B'], dedicated: false });
  expect(grantedAttackCommand(view, 'a2-p07-r3c1', false)).toBeNull();
  expect(grantedAttackCommand({ ...view, activeWindow: { kind: 'normal-defense', pendingActorId: 'A' } }, 'a2-p08-r1c1', false)).toBeNull();
  expect(grantedAttackCommand({ ...view, players: { ...view.players, B: { presence: 'dead' } } }, 'a2-p08-r1c1', false)).toBeNull();
  expect(grantedAttackCommand(view, 'a2-p10-r2c1', false)).toBeNull();
});

test('Fate ability cancellation uses only its opaque ability target and never falls back to card cancellation', async () => {
  const { buildCardCommand, eligibleReactionCards } = await import('../src/game/commands.js');
  expect(buildCardCommand('PLAY_REACTION', { cardId: 'a2-p02-r2c3', reactionMode: 'cancel-ability', targetAbilityId: 'ability-27' })).toEqual({ type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: 'ability-27' });
  expect(buildCardCommand('PLAY_REACTION', { cardId: 'a2-p02-r2c3', reactionMode: 'cancel-ability', targetActionId: 'card-3' })).toBeNull();
  expect(eligibleReactionCards('PLAY_REACTION', ['a2-p02-r2c3', 'a2-p07-r3c1'], [], 'cancel-ability')).toEqual(['a2-p02-r2c3']);
});

test('before-roll checks permit forced failure but only after-roll results permit reroll', async () => {
  const { reactionModes } = await import('../src/game/commands.js');
  expect(reactionModes('before-roll', 'check', true, false)).toEqual(['force-fail']);
  expect(reactionModes('before-roll', 'numeric', true, false)).toEqual([]);
  expect(reactionModes('after-roll', 'check', true, false)).toEqual(['reroll', 'force-fail']);
  expect(reactionModes('after-roll', 'numeric', true, false)).toEqual(['reroll']);
  expect(reactionModes('declaration', undefined, false, true)).toEqual(['cancel-ability']);
});

test('printed Shadow grant uses the saved additional-attack target instead of the defense card target', () => {
  const view = { ...input(), legalChoices: ['ATTACK', 'PASS'], activeWindow: { kind: 'ability-attack', pendingActorId: 'A' },
    currentAction: { source: 'card' as const, actorId: 'A', targetIds: ['A'] },
    additionalAttack: { source: 'card' as const, actorId: 'A', targetId: 'B', sourceCardInstanceId: 'a2-p08-r3c2' },
    additionalAttackOptions: [{ cardInstanceId: 'a2-p08-r1c1', dedicated: false }] };
  expect(grantedAttackCommand(view, 'a2-p08-r1c1', false)).toEqual({ type: 'ATTACK', cardInstanceId: 'a2-p08-r1c1', targetIds: ['B'], dedicated: false });
  expect(grantedAttackCommand({ ...view, additionalAttack: null }, 'a2-p08-r1c1', false)).toBeNull();
});

test('granted attacks require one complete authoritative candidate and exclude a near-only card at a far target', async () => {
  const { grantedAttackSources } = await import('../src/game/ability-input.js');
  const beast = 'a2-p09-r1c1';
  const ranged = 'a2-p08-r1c1';
  const nearOnly = 'a2-p08-r3c1';
  const component = 'a2-p24-r1c2';
  const advance = 'a2-p23-r1c2';
  const view: AbilityInputView = {
    ...input(),
    self: { ...input().self, hand: [beast, ranged, nearOnly, component, advance] },
    legalChoices: ['ATTACK', 'PASS'],
    activeWindow: { kind: 'ability-attack', pendingActorId: 'A' },
    additionalAttack: { source: 'card', actorId: 'A', targetId: 'B', sourceCardInstanceId: 'a2-p08-r3c2' },
    additionalAttackOptions: [
      { cardInstanceId: ranged, dedicated: false },
      { cardInstanceId: beast, dedicated: true },
      { cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: component, dedicated: false } },
    ],
    advanceCostOptions: [{ cardInstanceId: beast, advanceCardInstanceIds: [advance] }],
  };
  expect(grantedAttackSources(view)).toEqual([ranged, beast]);
  expect(grantedAttackCommand(view, nearOnly, false)).toBeNull();
  expect(grantedAttackCommand(view, ranged, true)).toBeNull();
  expect(grantedAttackCommand(view, ranged, false, 'one-hit')).toBeNull();
  expect(grantedAttackCommand(view, beast, true, undefined, { cardInstanceId: component, dedicated: true })).toBeNull();
  expect(grantedAttackCommand(view, beast, true, undefined, { cardInstanceId: component, dedicated: false })).toEqual({
    type: 'ATTACK', cardInstanceId: beast, targetIds: ['B'], dedicated: true,
    coSource: { cardInstanceId: component, dedicated: false },
  });
  expect(grantedAttackCommand(view, ranged, false)).toEqual({ type: 'ATTACK', cardInstanceId: ranged, targetIds: ['B'], dedicated: false });
  expect(grantedAttackCommand(view, beast, true, undefined, undefined, [advance])).toEqual({
    type: 'ATTACK', cardInstanceId: beast, targetIds: ['B'], dedicated: true, advanceCardInstanceIds: [advance],
  });
  expect(grantedAttackCommand(view, beast, true, undefined, undefined, [advance, advance])).toBeNull();
  expect(grantedAttackCommand(view, beast, true, undefined, { cardInstanceId: component, dedicated: false }, [component])).toBeNull();
  expect(grantedAttackCommand({ ...view, additionalAttackOptions: [] }, ranged, false)).toBeNull();
});

test('lifecycle-adapted abilities disappear from the ability list only while the lifecycle command is offered', () => {
  for (const abilityId of ['c2-p02-r2c2-ab05', 'c2-p04-r2c1-ab04', 'c2-p07-r1c2-ab04']) {
    const option = { abilityId, name: '継続', targetEventId: 'turn-6' };
    const view = { ...input(), abilityOptions: [option] };
    expect(selectableAbilities(view).map(item => item.abilityId)).toEqual([abilityId]);
    expect(abilityCommand(view, abilityId)).toEqual({ type: 'USE_ABILITY', abilityId, targetEventId: 'turn-6' });
    const lifecycle = { ...view, legalChoices: ['USE_ABILITY', 'USE_LIFECYCLE_ABILITY'] };
    expect(selectableAbilities(lifecycle)).toEqual([]);
    expect(abilityCommand(lifecycle, abilityId)).toBeNull();
  }
});
