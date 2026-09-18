import { expect, test } from 'vitest';
import { conditionalAbilityCommand, type ConditionalAbilityInputView, type ConditionalAbilitySetting } from '../src/game/conditional-ability-input.js';
const tia = 'c2-p02-r1c1-ab04'; const lia = 'c2-p03-r1c2-ab03';
function setting(overrides: Partial<ConditionalAbilitySetting> = {}): ConditionalAbilitySetting {
  return { abilityId: tia, name: 'ティアがんばる', description: '公開されたレスターが場にいれば精神力+1。', enabled: false, active: false, suppressed: false,
    selectedTargetIds: [], targetEventId: 'conditional:turn-4:action:A', canActivate: true, canDeactivate: false, ...overrides };
}
function view(value = setting()): ConditionalAbilityInputView { return { legalChoices: ['SET_CONDITIONAL_ABILITY'], conditionalAbilities: [value] }; }
test('conditional activation uses only the offered finite source and exact current event', () => {
  const current = view();
  expect(conditionalAbilityCommand(current, tia, true)).toEqual({ type: 'SET_CONDITIONAL_ABILITY', abilityId: tia, enabled: true, targetEventId: current.conditionalAbilities![0]!.targetEventId });
  expect(conditionalAbilityCommand(current, lia, true, [])).toBeNull();
  expect(conditionalAbilityCommand(view(setting({ abilityId: 'unregistered' })), 'unregistered', true)).toBeNull();
  expect(conditionalAbilityCommand(current, tia, true, [])).toBeNull();
  expect(conditionalAbilityCommand({ ...current, legalChoices: [] }, tia, true)).toBeNull();
  expect(conditionalAbilityCommand(view(setting({ canActivate: false })), tia, true)).toBeNull();
  expect(conditionalAbilityCommand(view(setting({ targetEventId: null })), tia, true)).toBeNull();
});
test('elected suppression permits explicit OFF only when offered, with no target payload', () => {
  const current = view(setting({ enabled: true, suppressed: true, canActivate: false, canDeactivate: true }));
  expect(conditionalAbilityCommand(current, tia, false)).toEqual({ type: 'SET_CONDITIONAL_ABILITY', abilityId: tia, enabled: false, targetEventId: current.conditionalAbilities![0]!.targetEventId });
  expect(conditionalAbilityCommand(current, tia, false, [])).toBeNull();
  expect(conditionalAbilityCommand(current, tia, true)).toBeNull();
  expect(conditionalAbilityCommand(view(setting()), tia, false)).toBeNull();
  expect(conditionalAbilityCommand(view(setting({ enabled: true, canDeactivate: false })), tia, false)).toBeNull();
});
test('Lia selects an explicit public subset, including empty, and rejects stale or duplicate targets', () => {
  const current = view(setting({ abilityId: lia, eligibleTargetIds: ['B', 'C'] }));
  expect(conditionalAbilityCommand(current, lia, true, ['C'])).toMatchObject({ abilityId: lia, enabled: true, targetIds: ['C'] });
  expect(conditionalAbilityCommand(current, lia, true, [])).toMatchObject({ targetIds: [] });
  expect(conditionalAbilityCommand(current, lia, true)).toBeNull();
  expect(conditionalAbilityCommand(current, lia, true, ['B', 'B'])).toBeNull();
  expect(conditionalAbilityCommand(current, lia, true, ['D'])).toBeNull();
  const saved = view(setting({ abilityId: lia, enabled: true, selectedTargetIds: ['B'], eligibleTargetIds: ['C'], canDeactivate: true }));
  expect(conditionalAbilityCommand(saved, lia, true, ['B', 'C'])).toBeNull();
  expect(conditionalAbilityCommand(saved, lia, true, ['C'])).toMatchObject({ targetIds: ['C'] });
  expect(conditionalAbilityCommand(saved, lia, false)).not.toHaveProperty('targetIds');
});
test('an identical ON configuration cannot consume another attempt, including reordered Lia targets', () => {
  expect(conditionalAbilityCommand(view(setting({ enabled: true })), tia, true)).toBeNull();
  const current = view(setting({ abilityId: lia, enabled: true, selectedTargetIds: ['B', 'C'], eligibleTargetIds: ['B', 'C'] }));
  expect(conditionalAbilityCommand(current, lia, true, ['C', 'B'])).toBeNull();
  expect(conditionalAbilityCommand(current, lia, true, ['B'])).toMatchObject({ targetIds: ['B'] });
});

test('every registered single-setting ability toggles ON and OFF without a target payload', () => {
  const singles = ['c2-p03-r2c2-ab04', 'c2-p04-r1c2-ab03', 'c2-p04-r1c2-ab05', 'c2-p05-r1c2-ab01', 'c2-p05-r2c1-ab05', 'c2-p06-r1c2-ab02'];
  for (const abilityId of singles) {
    const off = view(setting({ abilityId }));
    expect(conditionalAbilityCommand(off, abilityId, true)).toEqual({ type: 'SET_CONDITIONAL_ABILITY', abilityId, enabled: true, targetEventId: off.conditionalAbilities![0]!.targetEventId });
    expect(conditionalAbilityCommand(off, abilityId, true, [])).toBeNull();
    const on = view(setting({ abilityId, enabled: true, canActivate: false, canDeactivate: true }));
    expect(conditionalAbilityCommand(on, abilityId, false)).toEqual({ type: 'SET_CONDITIONAL_ABILITY', abilityId, enabled: false, targetEventId: on.conditionalAbilities![0]!.targetEventId });
    expect(conditionalAbilityCommand(on, abilityId, true)).toBeNull();
    expect(conditionalAbilityCommand({ ...off, legalChoices: [] }, abilityId, true)).toBeNull();
  }
});
