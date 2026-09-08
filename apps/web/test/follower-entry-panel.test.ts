import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { AbilityChoice } from '../src/game/AbilityPanel.js';
import { FollowerEntrySummary } from '../src/game/FollowerEntrySummary.js';
import { ActionSummary } from '../src/game/ActionSummary.js';
import type { AbilityInputView } from '../src/game/ability-input.js';

const option = { abilityId: 'c2-p03-r2c1-ab02', name: '幻術', targetEventId: 'attack-1', effectOptions: [
  { id: 'spirit-conversion' as const, name: '技の精神化' }, { id: 'human-invalidation' as const, name: '人の従者を無効' },
] };
function view(): AbilityInputView {
  return { self: { id: 'A', hand: ['a2-p23-r1c2'], chants: [] }, abilityOptions: [option], legalChoices: ['USE_ABILITY'], activeWindow: null,
    currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [], players: { A: { presence: 'active' } } };
}
test('illusion presents independent unchecked effects and cannot submit before choosing any', () => {
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view: view(), option, disabled: false, send: () => true }));
  expect(html).toContain('技の精神化'); expect(html).toContain('人の従者を無効'); expect(html).not.toContain('checked');
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>幻術を使う<\/button>/);
});
test('surprise labels its exact advance payment without misleading Ida distance-card wording', () => {
  const tia = { abilityId: 'c2-p02-r1c1-ab02', name: '奇襲', targetEventId: 'entry-B', costCardInstanceIds: ['a2-p23-r1c2'] };
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view: { ...view(), abilityOptions: [tia] }, option: tia, disabled: false, send: () => true }));
  expect(html).toContain('消費する踏み込み'); expect(html).not.toContain('消費する間合い');
  expect(html).toContain('取り消されても'); expect(html).toMatch(/<button[^>]*disabled=""[^>]*>奇襲を使う<\/button>/);
});
test('entry explains the fixed defense boundary and virtual defense stays separate from physical cards', () => {
  const entry = renderToStaticMarkup(createElement(FollowerEntrySummary, { entry: { groupId: 'g-1', targetId: 'B', attackerId: 'A', reason: 'before-follower-snapshot', virtualGuardSelected: true }, sources: [], names: { A: '葵', B: '楓' } }));
  const frozen = renderToStaticMarkup(createElement(FollowerEntrySummary, { entry: null, sources: [{ source: 'virtual', sourceId: 'virtual-g-1-B', targetId: 'B', position: -1, name: '仮想従者', levels: [4, 4, 4], hp: 1, attributes: ['人', '女'], moraleRequired: false, cancelIgnore: true,
      hits: [{ hitIndex: 0, outcome: 'lower-destroyed', hpReduction: 1 }] }], names: { A: '葵', B: '楓' } }));
  const html = entry + frozen;
  expect(entry).toContain('楓'); expect(entry).toContain('通常防御へは戻れません'); expect(html).toContain('物理の札は増えません');
  expect(html).toContain('従者Lv 4'); expect(html).toContain('HP 1'); expect(html).toContain('士気判定はありません');
  expect(html).not.toContain('cardInstanceId'); expect(html).not.toContain('virtual-g-1-B');
});
test('a converted technique shows original warrior school alongside its added spirit attribute', () => {
  const html = renderToStaticMarkup(createElement(ActionSummary, { action: { source: 'card', actionId: 'a-1', kind: 'attack', actorId: 'A', cardInstanceId: 'a2-p08-r1c1', targetIds: ['B'], stage: 'resolve',
    technique: { school: 'warrior', range: 'far', attributes: ['戦', '剣', '精'], useLevel: 5, effectLevel: 5, damage: 7 } }, names: { A: '葵', B: '楓' } }));
  expect(html).toContain('戦士技'); expect(html).toContain('戦・剣・精'); expect(html).toContain('使用値 5');
});
