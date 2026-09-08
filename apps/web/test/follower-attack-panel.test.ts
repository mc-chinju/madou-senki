import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { PlayerView } from '@madou/engine';
import { FollowerAttackPanel, FollowerAttackTargets } from '../src/game/FollowerAttackPanel.js';
import type { FollowerAttackOption } from '../src/game/follower-attack-input.js';
import { ActionSummary } from '../src/game/ActionSummary.js';

const option: FollowerAttackOption = { cardInstanceId: 'a2-p22-r3c3', dedicated: true, sourceZone: 'followers', targetMode: 'mandatory-all', legalTargetIds: ['B', 'C'],
  range: 'far', school: 'magic', attributes: ['魔', '白'], useLevel: 7, effectLevel: 7, damage: 10, hitCount: 1, noChecks: true };
const names = { B: '楓', C: '凛' };
test('mandatory-all is a fixed visible recipient set while selected-all offers explicit checkboxes', () => {
  const fixed = renderToStaticMarkup(createElement(FollowerAttackTargets, { option, names, selected: [], disabled: false, change: () => {} }));
  expect(fixed).toContain('楓'); expect(fixed).toContain('凛'); expect(fixed).toContain('全員'); expect(fixed).not.toContain('type="checkbox"');
  const selectable = renderToStaticMarkup(createElement(FollowerAttackTargets, { option: { ...option, targetMode: 'selected-all' }, names, selected: [], disabled: false, change: () => {} }));
  expect(selectable.match(/type="checkbox"/g)).toHaveLength(2); expect(selectable).not.toContain('checked');
});
test('the attack panel begins without a source or dedicated consent and explains placed-source loss', () => {
  const view = { self: { id: 'A', hand: [], followers: [{ cardInstanceId: option.cardInstanceId }] }, players: { B: { name: '楓' }, C: { name: '凛' } },
    legalChoices: ['ATTACK'], activeWindow: null, followerAttackOptions: [option] } as unknown as PlayerView;
  const html = renderToStaticMarkup(createElement(FollowerAttackPanel, { view, disabled: false, send: () => true }));
  expect(html).toContain('守護者（配置中）'); expect(html).toContain('<option value="" selected="">');
  expect(html).toContain('攻撃に使うと従者から外れ、使用後は捨て札になります');
  expect(html).not.toContain('checked'); expect(html).toMatch(/<button[^>]*disabled=""[^>]*>従者で攻撃する<\/button>/);
});
test('a paid placed follower attack is distinguished from automatic follower reflection', () => {
  const action = { source: 'card', kind: 'attack', actionId: 'paid-1', actorId: 'A', cardInstanceId: option.cardInstanceId, sourceZone: 'followers', targetIds: ['B'], stage: 'declaration',
    technique: { range: 'far', attributes: ['魔', '白'], useLevel: 7, effectLevel: 7, damage: 10 } } as unknown as PlayerView['currentAction'];
  const html = renderToStaticMarkup(createElement(ActionSummary, { action, names: { A: '葵', ...names } }));
  expect(html).toContain('配置中の従者を使用'); expect(html).not.toContain('による反射');
});
