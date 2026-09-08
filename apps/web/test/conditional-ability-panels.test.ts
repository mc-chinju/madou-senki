import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ConditionalAbilityPanel } from '../src/game/ConditionalAbilityPanel.js';
import type { ConditionalAbilitySetting } from '../src/game/conditional-ability-input.js';
function setting(overrides: Partial<ConditionalAbilitySetting> = {}): ConditionalAbilitySetting {
  return { abilityId: 'c2-p02-r1c1-ab04', name: 'ティアがんばる', description: '公開されたレスターが場にいれば精神力+1。', enabled: false, active: false, suppressed: false,
    selectedTargetIds: [], targetEventId: 'conditional-turn-4', canActivate: true, canDeactivate: false, ...overrides };
}
function render(values: ConditionalAbilitySetting[]) {
  return renderToStaticMarkup(createElement(ConditionalAbilityPanel, { view: { legalChoices: ['SET_CONDITIONAL_ABILITY'], conditionalAbilities: values }, names: { A: '葵', B: '楓', C: '凛' }, disabled: false, send: () => true }));
}
test('conditional settings start unused and explain reservation without promising an unmet bonus', () => {
  const html = render([setting()]);
  expect(html).toContain('継続する特殊能力'); expect(html).toContain('公開されたレスター');
  expect(html).toContain('使用しない設定'); expect(html).toContain('条件を満たした間だけ');
  expect(html).toContain('使用する設定を宣言'); expect(html).not.toContain('checked=""');
  expect(render([])).toBe('');
});
test('suppressed elected source remains identifiable and offers OFF without a new activation', () => {
  const html = render([setting({ enabled: true, suppressed: true, canActivate: false, canDeactivate: true })]);
  expect(html).toContain('使用する設定を保持'); expect(html).toContain('停止・能力禁止により一時停止');
  expect(html).toContain('使用しない設定に戻す'); expect(html).not.toContain('使用する設定を宣言');
});
test('Lia shows selected public names including a temporarily ineligible saved target', () => {
  const html = render([setting({ abilityId: 'c2-p03-r1c2-ab03', name: 'この世界に愛を', enabled: true, active: true, canDeactivate: true, selectedTargetIds: ['B'], eligibleTargetIds: ['C'] })]);
  expect(html).toContain('現在の選択：楓'); expect(html).toContain('楓（現在は選べません）'); expect(html).toContain('凛');
  expect(html).toContain('誰も選ばなくても'); expect(html).toContain('対象の変更を宣言');
  expect(html).toMatch(/<button disabled="">対象の変更を宣言/);
});
