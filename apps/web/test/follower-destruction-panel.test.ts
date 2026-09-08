import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { FollowerDestructionSummary } from '../src/game/FollowerDestructionSummary.js';
import { AbilityChoice } from '../src/game/AbilityPanel.js';
import type { AbilityInputView } from '../src/game/ability-input.js';
import type { PlayerView } from '@madou/engine';

const names = { A: '葵', B: '楓', C: '凛' };
test('unreached followers and absent attack effects do not create an empty summary', () => {
  expect(renderToStaticMarkup(createElement(FollowerDestructionSummary, { attack: null, results: [], names }))).toBe('');
});
test('reached outcomes retain physical identity permissions and distinguish virtual destruction without a fake card', () => {
  const results: PlayerView['followerDefenseResults'] = [
    { targetId: 'B', source: 'physical', position: 0, cardInstanceId: 'a2-p22-r3c1', hits: [{ hitIndex: 0, outcome: 'attribute-destroyed', hpReduction: 0 }] },
    { targetId: 'B', source: 'physical', position: 1, hits: [{ hitIndex: 0, outcome: 'passed-through', hpReduction: 0 }] },
    { targetId: 'C', source: 'virtual', position: -1, hits: [{ hitIndex: 2, outcome: 'attribute-destroyed', hpReduction: 0 }] },
  ];
  const html = renderToStaticMarkup(createElement(FollowerDestructionSummary, { attack: null, results, names }));
  expect(html).toContain('aria-live="polite"');
  expect(html).toMatch(/楓[^]*飛竜[^]*1発目[^]*属性による破壊[^]*HP軽減 0/);
  expect(html).toContain('裏向きの従者（2番目）'); expect(html).toContain('通過');
  expect(html).toMatch(/凛[^]*仮想女性親衛隊[^]*3発目[^]*属性による破壊/);
  expect(html).not.toContain('a2-'); expect(html).not.toContain('c2-'); expect(html).not.toContain('undefined');
});
test('attack effects and target damage come from each public hit rather than the group fallback', () => {
  const attack: PlayerView['currentAttack'] = { groupId: 'private-group', actionId: 'private-action', attackerId: 'A', targetIds: ['B', 'C'], hitIndex: 0, targetId: 'B', reason: 'normal-defense',
    technique: { effectLevel: 5, damage: 7, attributes: ['戦', '剣'], beastIgnore: false, destructionEffects: ['グループの値を流用しない'] },
    defenseRestrictions: { maaiProhibited: false, evadeProhibited: false, counterProhibited: false },
    targets: [
      { actorId: 'B', hits: [{ index: 0, defended: false, hit: false, sourceCardInstanceId: 'a2-p08-r1c1', technique: { effectLevel: 5, damage: 14, attributes: ['戦', '剣'], beastIgnore: false, destructionEffects: ['黒または死の従者を破壊'] } }] },
      { actorId: 'C', hits: [{ index: 1, defended: false, hit: false, technique: { effectLevel: 4, damage: null, attributes: ['魔', '風'], beastIgnore: false, destructionEffects: ['従者Lv6以下を破壊'] } }] },
    ] };
  const html = renderToStaticMarkup(createElement(FollowerDestructionSummary, { attack, results: [], names }));
  expect(html).toMatch(/楓[^]*1発目[^]*黒翼飛翔剣[^]*ダメージ 14[^]*黒または死/);
  expect(html).toMatch(/凛[^]*2発目[^]*ダメージ なし[^]*従者Lv6以下/);
  expect(html).not.toContain('ダメージ 7'); expect(html).not.toContain('グループの値を流用しない'); expect(html).not.toContain('private-');
});
test.each([
  ['c2-p02-r2c1-ab02', '竜殺槍', ['戦士技', '竜', '到達した従者']],
  ['c2-p02-r2c2-ab02', '白龍の剣', ['剣技', '黒または死', 'ガドューラ', '2倍', '一度の選択']],
  ['c2-p04-r1c2-ab01', '風龍の剣', ['剣技または風技', '確定した従者Lvが6以下']],
  ['c2-p06-r1c1-ab03', '狂魂', ['人属性', '仮想女性親衛隊']],
])('%s explains the complete optional package without adding choices or costs', (abilityId, name, phrases) => {
  const option = { abilityId, name, targetEventId: 'attack-event' };
  const view: AbilityInputView = { self: { id: 'A', hand: [], chants: [] }, abilityOptions: [option], legalChoices: ['USE_ABILITY'], activeWindow: null,
    currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [], players: { A: { presence: 'active' } } };
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view, option, disabled: false, send: () => true }));
  for (const phrase of phrases) expect(html).toContain(phrase);
  expect(html).toContain(`${name}を使う`); expect(html).not.toContain('type="checkbox"'); expect(html).not.toContain('<select');
});
