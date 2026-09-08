import { expect, test } from 'vitest';
import { abilityCommand, type AbilityInputView } from '../src/game/ability-input.js';

const illusion = 'c2-p03-r2c1-ab02';
function input(): AbilityInputView {
  return { self: { id: 'A', hand: [], chants: [] }, legalChoices: ['USE_ABILITY'], activeWindow: { kind: 'attack-abilities', pendingActorId: 'A' },
    abilityOptions: [{ abilityId: illusion, name: '幻術', targetEventId: 'attack-8', effectOptions: [
      { id: 'spirit-conversion', name: '技の精神化' }, { id: 'human-invalidation', name: '人の従者を無効' }, { id: 'arnes-suppression', name: '公開された女性親衛隊能力を無効' },
    ] }], currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [], players: { A: { presence: 'active' }, B: { presence: 'active' } } };
}
test('illusion requires an explicit nonempty subset of the exact private effect offer', () => {
  const view = input();
  expect(abilityCommand(view, illusion)).toBeNull();
  expect(abilityCommand(view, illusion, undefined, false, ['human-invalidation', 'human-invalidation'])).toBeNull();
  expect(abilityCommand(view, illusion, undefined, false, ['unknown'])).toBeNull();
  expect(abilityCommand(view, illusion, undefined, false, ['human-invalidation'])).toEqual({
    type: 'USE_ABILITY', abilityId: illusion, targetEventId: 'attack-8', abilityEffectIds: ['human-invalidation'],
  });
  expect(abilityCommand(view, illusion, undefined, false, ['arnes-suppression', 'spirit-conversion'])).toEqual({
    type: 'USE_ABILITY', abilityId: illusion, targetEventId: 'attack-8', abilityEffectIds: ['spirit-conversion', 'arnes-suppression'],
  });
});
test('branch construction rejects no-longer-offered conversion and never adds illusion choices to another ability', () => {
  const view = input(); view.abilityOptions[0]!.effectOptions = view.abilityOptions[0]!.effectOptions!.filter(effect => effect.id !== 'spirit-conversion');
  expect(abilityCommand(view, illusion, undefined, false, ['spirit-conversion'])).toBeNull();
  expect(abilityCommand({ ...view, legalChoices: [] }, illusion, undefined, false, ['human-invalidation'])).toBeNull();
  const guard = 'c2-p03-r2c2-ab02'; view.abilityOptions = [{ abilityId: guard, name: '女性親衛隊', targetEventId: 'entry-9' }];
  expect(abilityCommand(view, guard, undefined, false, ['human-invalidation'])).toBeNull();
  expect(abilityCommand(view, guard)).toEqual({ type: 'USE_ABILITY', abilityId: guard, targetEventId: 'entry-9' });
});
test('surprise consumes exactly an offered owned advance without adding concealment or branch fields', () => {
  const view = input(); const tia = 'c2-p02-r1c1-ab02';
  view.self.hand = ['a2-p23-r1c2', 'a2-p07-r3c1'];
  view.abilityOptions = [{ abilityId: tia, name: '奇襲', targetEventId: 'entry-B', costCardInstanceIds: ['a2-p23-r1c2'] }];
  expect(abilityCommand(view, tia)).toBeNull();
  expect(abilityCommand(view, tia, 'a2-p07-r3c1')).toBeNull();
  expect(abilityCommand(view, tia, 'a2-p23-r1c2')).toEqual({ type: 'USE_ABILITY', abilityId: tia, targetEventId: 'entry-B', costCardInstanceId: 'a2-p23-r1c2' });
  view.self.hand = [];
  expect(abilityCommand(view, tia, 'a2-p23-r1c2')).toBeNull();
});
