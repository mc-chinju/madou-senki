import { expect, test } from 'vitest';
import type { DeclarationCandidate } from '@madou/engine';
import { techniqueFor } from '../../../packages/engine/src/effects/registry.js';
import { applyDeclarationSelection, declarationEffectText, defenseCardChoices } from '../src/game/declaration-input.js';

function source(): DeclarationCandidate {
  return { kind: 'attack', choice: { cardInstanceId: 'a2-p09-r3c2', dedicated: false }, sourceZone: 'hand', fromChant: false,
    technique: techniqueFor('a2-p09-r3c2')!, abilities: [{ abilityId: 'c2-p01-r1c2-ab03', name: '拳圧', effects: { far: true } }],
    targetIds: ['B', 'C'], nearTargetIds: ['B'] };
}
const attack = { type: 'ATTACK' as const, cardInstanceId: 'a2-p09-r3c2', targetIds: ['C'], dedicated: false };
test('range expansion requires the explicit offered selection and keeps the exact physical source', () => {
  const view = { declarationCandidates: [source()] };
  expect(applyDeclarationSelection(view, attack, [])).toBeNull();
  expect(applyDeclarationSelection(view, attack, ['c2-p01-r1c2-ab03'])).toEqual({ ...attack, declarationAbilityIds: ['c2-p01-r1c2-ab03'] });
  expect(applyDeclarationSelection(view, attack, ['foreign'])).toBeNull();
  expect(applyDeclarationSelection(view, attack, ['c2-p01-r1c2-ab03', 'c2-p01-r1c2-ab03'])).toBeNull();
  expect(applyDeclarationSelection({}, attack, ['c2-p01-r1c2-ab03'])).toBeNull();
});
test('a saved single-target grant cannot grow through an all-target declaration ability', () => {
  const candidate = { ...source(), grantTargetId: 'B', abilities: [{ abilityId: 'all', name: '全体化', effects: { far: true, allTargets: true } }] };
  const view = { declarationCandidates: [candidate] };
  expect(applyDeclarationSelection(view, { ...attack, targetIds: ['B', 'C'] }, ['all'])).toBeNull();
  expect(applyDeclarationSelection(view, { ...attack, targetIds: ['B'] }, ['all'])).toMatchObject({ targetIds: ['B'], declarationAbilityIds: ['all'] });
});
test('whole-package text distinguishes independent dice and an exact replacement from an addition', () => {
  const text = declarationEffectText({ waiveChant: true, effectReplacement: 10, effectAddition: 1, effectDie: true, damageDie: true, damageDouble: true });
  for (const term of ['詠唱なし', '効果Lvを10にする', '効果Lv+1', '効果Lv+1d6', '効果Lvとは別に振る', 'ダメージ2倍']) expect(text).toContain(term);
});

function defenseCandidate(cardInstanceId: string, dedicated: boolean, technique: DeclarationCandidate['technique'],
  abilities: DeclarationCandidate['abilities'], incomingTechnique: DeclarationCandidate['technique']): DeclarationCandidate {
  return { kind: 'defense', choice: { cardInstanceId, dedicated }, sourceZone: 'hand', fromChant: false,
    technique, abilities, incomingTechnique, targetIds: [], nearTargetIds: [] };
}
const incoming = { ...techniqueFor('a2-p10-r1c1')!, effectLevel: 8 };

test('defense option admission matches the currently selected dedicated mode', () => {
  const whiteLight = 'a2-p14-r1c2';
  const dedicatedWhiteLight = defenseCandidate(whiteLight, true, techniqueFor(whiteLight, '白魔術師シェリム', true)!, [
    { abilityId: 'c2-p01-r1c1-ab03', name: '大魔術師', effects: { waiveChant: true } },
  ], incoming);
  expect(defenseCardChoices({ declarationCandidates: [dedicatedWhiteLight] }, [], false)).toEqual([]);
});

test('defense option admission removes an impossible candidate but retains ordinary choices', () => {
  const whiteLight = 'a2-p14-r1c2';
  const dedicatedWhiteLight = defenseCandidate(whiteLight, true, techniqueFor(whiteLight, '白魔術師シェリム', true)!, [
    { abilityId: 'c2-p01-r1c1-ab03', name: '大魔術師', effects: { waiveChant: true } },
  ], incoming);
  const prohibited = { ...dedicatedWhiteLight, incomingTechnique: { ...incoming, counterProhibited: true } };
  expect(defenseCardChoices({ declarationCandidates: [prohibited] }, ['a2-p06-r1c1'], true)).toEqual(['a2-p06-r1c1']);
});

test('defense option admission retains combined conversion, waiver, and bounded random legalization', () => {
  const converted = defenseCandidate('a2-p10-r1c3', false, { ...techniqueFor('a2-p10-r1c3')!, effectLevel: 9 }, [
    { abilityId: 'c2-p01-r2c1-ab01', name: 'ツバメ返し', effects: { counter: true, spiritCheck: true } },
    { abilityId: 'c2-p01-r2c1-ab02', name: '居合抜き', effects: { waiveChant: true, spiritCheck: true } },
  ], incoming);
  expect(defenseCardChoices({ declarationCandidates: [converted] }, [], false)).toEqual(['a2-p10-r1c3']);

  const boundedRandom = defenseCandidate('a2-p08-r2c3', false, techniqueFor('a2-p08-r2c3')!, [
    { abilityId: 'c2-p06-r2c2-ab02', name: '野獣', effects: { noChecks: true, effectDie: true, damageDie: true } },
  ], incoming);
  expect(defenseCardChoices({ declarationCandidates: [boundedRandom] }, [], false)).toEqual(['a2-p08-r2c3']);
});

test('defense option admission preserves a legal base when exact replacement lowers the selected preview', () => {
  const highCounter = defenseCandidate('high-counter', false, {
    ...techniqueFor('a2-p10-r1c3')!, chant: false, defense: 'counter', counter: true, effectLevel: 12,
  }, [{ abilityId: 'c2-p07-r1c2-ab02', name: '破壊の神', effects: { waiveChant: true, effectReplacement: 10 } }],
  { ...incoming, effectLevel: 11 });
  expect(defenseCardChoices({ declarationCandidates: [highCounter] }, ['high-counter'], false)).toEqual(['high-counter']);

  const replacementConflict = defenseCandidate('replacement-conflict', false, {
    ...techniqueFor('a2-p10-r1c3')!, effectLevel: 12,
  }, [
    { abilityId: 'c2-p01-r2c1-ab01', name: 'ツバメ返し', effects: { counter: true, spiritCheck: true } },
    { abilityId: 'c2-p01-r2c1-ab02', name: '居合抜き', effects: { waiveChant: true, spiritCheck: true } },
    { abilityId: 'c2-p07-r1c2-ab02', name: '破壊の神', effects: { waiveChant: true, effectReplacement: 10 } },
  ], { ...incoming, effectLevel: 11 });
  expect(defenseCardChoices({ declarationCandidates: [replacementConflict] }, [], false)).toEqual(['replacement-conflict']);
});
