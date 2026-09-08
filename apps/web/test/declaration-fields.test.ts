import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { DeclarationCandidate } from '@madou/engine';
import { techniqueFor } from '../../../packages/engine/src/effects/registry.js';
import { DeclarationFields } from '../src/game/DeclarationFields.js';

const candidate: DeclarationCandidate = {
  kind: 'attack', choice: { cardInstanceId: 'a2-p10-r1c1', dedicated: false }, sourceZone: 'hand', fromChant: false,
  technique: techniqueFor('a2-p10-r1c1')!, targetIds: ['B'], nearTargetIds: ['B'],
  abilities: [{ abilityId: 'c2-p06-r2c2-ab02', name: '野獣', effects: { noChecks: true, effectDie: true, damageDie: true } }],
};
test('the whole package is one unchecked choice and its dice preview explicitly remains a maximum', () => {
  const html = renderToStaticMarkup(createElement(DeclarationFields, { candidate, selected: [], disabled: false, onChange: () => {} }));
  expect(html).toContain('技と一緒に使う能力');
  expect(html).toContain('野獣');
  expect(html).toContain('効果Lvとは別に振る');
  expect(html.match(/type="checkbox"/g)).toHaveLength(1);
  expect(html).not.toContain('checked=""');
  const chosen = renderToStaticMarkup(createElement(DeclarationFields, { candidate, selected: ['c2-p06-r2c2-ab02'], disabled: true, onChange: () => {} }));
  expect(chosen).toContain('効果Lvの上限 13');
  expect(chosen).toContain('出目によって確定');
  expect(chosen).toContain('checked=""');
  expect(chosen).toContain('disabled=""');
});

test('an unselected source that still needs chant explains why declaration is unavailable', () => {
  const unchanted = { ...candidate, technique: { ...candidate.technique, chant: true } };
  const html = renderToStaticMarkup(createElement(DeclarationFields, { candidate: unchanted, selected: [], disabled: false, onChange: () => {} }));
  expect(html).toContain('この札は先に詠唱する必要があります。');
});
