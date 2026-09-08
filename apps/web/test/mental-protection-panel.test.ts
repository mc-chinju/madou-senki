import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { AbilityChoice } from '../src/game/AbilityPanel.js';
import { abilityCommand, type AbilityInputView } from '../src/game/ability-input.js';

const cases = [
  { abilityId: 'c2-p05-r2c1-ab02', name: '執念', description: '今回の精神力判定のゾロ目による追加効果を無効にする（通常失敗は有効）。' },
  { abilityId: 'c2-p05-r2c1-ab02', name: '執念', description: '今回受ける精神技による停止だけを防ぐ。ダメージや抵抗判定は残る。' },
  { abilityId: 'c2-p06-r1c1-ab02', name: '死者', description: '宣言中の特殊能力を取り消す。' },
  { abilityId: 'c2-p06-r1c1-ab02', name: '死者', description: '今回受ける精神技の効果をすべて無効にする。' },
];
test.each(cases)('$name displays the offered clause: $description', entry => {
  const option = { ...entry, targetEventId: 'pinned-source' };
  const view: AbilityInputView = {
    self: { id: 'A', hand: [], chants: [] }, abilityOptions: [option], legalChoices: ['USE_ABILITY'],
    activeWindow: null, currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [],
    players: { A: { presence: 'active' } },
  };
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view, option, disabled: false, send: () => true }));
  expect(html).toContain(entry.description);
  expect(html).toContain(`${entry.name}を使う`);
  expect(html).not.toContain('<select');
  expect(html).not.toContain('type="checkbox"');
  expect(abilityCommand(view, entry.abilityId)).toEqual({ type: 'USE_ABILITY', abilityId: entry.abilityId, targetEventId: 'pinned-source' });
});
