import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ActionSummary } from '../src/game/ActionSummary.js';
import { AbilityChoice } from '../src/game/AbilityPanel.js';
import { ActionCalculationSummary } from '../src/game/ActionCalculationSummary.js';
import type { AbilityInputView } from '../src/game/ability-input.js';

const names = { A: '葵', B: '楓' };
const action = { source: 'card' as const, actionId: 'a-1', kind: 'attack', actorId: 'A', cardInstanceId: 'a2-p10-r3c1', targetIds: ['B'], stage: 'damage',
  technique: { school: 'warrior' as const, range: 'near', attributes: ['戦', '格'], useLevel: 5, effectLevel: 7, damage: 2,
    calculation: { effectLevel: 'final' as const, damage: 'pending' as const } } };
test('current technique distinguishes a frozen effect from damage awaiting its independent bonus', () => {
  const html = renderToStaticMarkup(createElement(ActionSummary, { action, names }));
  expect(html).toContain('効果値 7（確定）'); expect(html).toContain('ダメージ 2（計算中）'); expect(html).toContain('使用値 5');
});
test('an ability child retains a public named parent calculation without printing source identifiers', () => {
  const html = renderToStaticMarkup(createElement(ActionCalculationSummary, { value: { actionId: 'opaque-parent', actorId: 'A', cardInstanceId: 'a2-p10-r3c1', effectLevel: 7, damage: 2,
    calculation: { effectLevel: 'final', damage: 'pending' } }, currentAction: { source: 'ability', kind: 'ability', actorId: 'A', targetIds: ['B'], actionId: 'opaque-child', stage: 'numeric', label: '能力の使用' }, names }));
  expect(html).toContain('葵'); expect(html).toContain('狼牙'); expect(html).toContain('効果Lv 7（確定）'); expect(html).toContain('ダメージ 2（計算中）');
  expect(html).not.toContain('opaque-'); expect(html).not.toContain('c2-');
});
test('parent calculation avoids duplicated summaries and preserves damage-less final values', () => {
  const value = { actionId: 'a-1', actorId: 'A', cardInstanceId: 'a2-p15-r2c3', effectLevel: 7, damage: null, calculation: { effectLevel: 'final' as const, damage: 'final' as const } };
  expect(renderToStaticMarkup(createElement(ActionCalculationSummary, { value, currentAction: action, names }))).toBe('');
  const html = renderToStaticMarkup(createElement(ActionCalculationSummary, { value, currentAction: null, names }));
  expect(html).toContain('ダメージ なし（確定）'); expect(html).not.toContain('ダメージ 0');
});
test.each([
  ['c2-p01-r1c1-ab02', '賢者の杖', ['魔法技の効果Lvを1']],
  ['c2-p01-r1c2-ab02', '鉄拳', ['別のサイコロ1個']],
  ['c2-p01-r2c1-ab03', '気合い', ['精神力の判定']],
  ['c2-p03-r1c1-ab03', '斧使い', ['宣言時、この戦士技の使用Lvがあなたの戦士Lv以下なら', 'ダメージを2倍', '弓技には使えません']],
  ['c2-p05-r1c1-ab02', '破壊神の力', ['黒魔法の効果Lv']],
])('%s describes its actual effect and requires explicit use', (abilityId, name, expected) => {
  const option = { abilityId, name, targetEventId: 'actual-action' };
  const view: AbilityInputView = { self: { id: 'A', hand: [], chants: [] }, abilityOptions: [option], legalChoices: ['USE_ABILITY'], activeWindow: null,
    currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [], players: { A: { presence: 'active' } } };
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view, option, disabled: false, send: () => true }));
  for (const phrase of expected) expect(html).toContain(phrase);
  expect(html).toContain(`${name}を使う`); expect(html).not.toContain('checked'); expect(html).not.toContain('<select');
});
