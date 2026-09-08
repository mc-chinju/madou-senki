import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { AbilityChoice } from '../src/game/AbilityPanel.js';
import { abilityCommand, type AbilityInputView } from '../src/game/ability-input.js';

const cases = [
  { abilityId: 'c2-p01-r2c1-ab05', name: '鏡心', terms: ['自分とイダが公開', '宣言中の影分身', '今回の使用', '取り消されても'] },
  { abilityId: 'c2-p07-r1c1-ab02', name: '悲しみを胸に', terms: ['公開されたガイナス', '自分の攻撃', '魔導王の威厳', '今回の使用', '取り消されても'] },
] as const;
function fixture(entry: typeof cases[number]): AbilityInputView {
  return {
    self: { id: 'A', hand: [], chants: [] },
    abilityOptions: [{ abilityId: entry.abilityId, name: entry.name, targetEventId: 'ability-source-47' }],
    legalChoices: ['USE_ABILITY'],
    activeWindow: null,
    currentAction: null,
    additionalAttack: null,
    additionalAttackOptions: [],
    advanceCostOptions: [],
    players: { A: { presence: 'active' } },
  };
}
test.each(cases)('$name describes only the current source cancellation and its public conditions', entry => {
  const view = fixture(entry);
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view, option: view.abilityOptions[0]!, disabled: false, send: () => true }));
  for (const term of entry.terms) expect(html).toContain(term);
  expect(html).not.toContain('<select');
  expect(html).not.toContain('type="checkbox"');
  expect(html).toContain(`${entry.name}を使う`);
});
test.each(cases)('$name echoes the opaque pinned source identity from the option', entry => {
  const view = fixture(entry);
  expect(abilityCommand(view, entry.abilityId)).toEqual({
    type: 'USE_ABILITY', abilityId: entry.abilityId, targetEventId: 'ability-source-47',
  });
});
