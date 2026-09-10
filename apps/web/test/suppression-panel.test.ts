import { expect, test } from 'vitest';
import { selectableAbilities } from '../src/game/ability-input.js';

const ban = 'c2-p07-r1c2-ab03';
const bless = 'c2-p03-r1c2-ab04';

test('paired suppression choices are excluded from the generic single-target ability panel', () => {
  const options = [
    { abilityId: ban, name: '神と人の差', targetEventId: 'opportunity', targetIds: ['B', 'C'] },
    { abilityId: bless, name: '祝福', targetEventId: 'turn', targetIds: ['B'] },
    { abilityId: 'c2-p01-r2c1-ab03', name: '気合い', targetEventId: 'attack' },
  ];
  expect(selectableAbilities({ abilityOptions: options, legalChoices: ['USE_ABILITY'] }).map(option => option.abilityId)).toEqual(['c2-p01-r2c1-ab03']);
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SuppressionPanel } from '../src/game/SuppressionPanel.js';
import { suppressionCommand, type SuppressionInputView } from '../src/game/suppression-input.js';

function view(): SuppressionInputView {
  return {
    legalChoices: ['USE_ABILITY'],
    abilityOptions: [{ abilityId: ban, name: '神と人の差', targetEventId: 'public:7', targetIds: ['B', 'C'], actionCost: 'extra' }],
    players: { B: { name: '葵' }, C: { name: '楓' } },
    suppressionTargets: [{ targetId: 'B', designated: true, applicability: 'private' }],
  };
}
test('ban submits a bounded multiple-target declaration tied to the offered opportunity', () => {
  const current = view();
  expect(suppressionCommand(current, ban, 'public:7', ['B', 'C'])).toEqual({ type: 'USE_ABILITY', abilityId: ban, targetEventId: 'public:7', targetIds: ['B', 'C'] });
  for (const ids of [[], ['B', 'B'], ['D'], ['B', 'D']]) expect(suppressionCommand(current, ban, 'public:7', ids)).toBeNull();
  expect(suppressionCommand(current, ban, 'old', ['B'])).toBeNull();
  expect(suppressionCommand({ ...current, legalChoices: [] }, ban, 'public:7', ['B'])).toBeNull();
  expect(suppressionCommand({ ...current, abilityOptions: [] }, ban, 'public:7', ['B'])).toBeNull();
});
test('Blessing sends exactly one offered target without a multiple-target payload', () => {
  const current = { ...view(), abilityOptions: [{ abilityId: bless, name: '祝福', targetEventId: 'turn:3', targetIds: ['B', 'C'] }] };
  expect(suppressionCommand(current, bless, 'turn:3', ['C'])).toEqual({ type: 'USE_ABILITY', abilityId: bless, targetEventId: 'turn:3', targetId: 'C' });
  expect(suppressionCommand(current, bless, 'turn:3', ['B', 'C'])).toBeNull();
  expect(suppressionCommand(current, ban, 'turn:3', ['B'])).toBeNull();
});
test('new candidate projection refuses previously selected targets that disappeared', () => {
  const current = view();
  current.abilityOptions[0]!.targetIds = ['C'];
  expect(suppressionCommand(current, ban, 'public:7', ['B'])).toBeNull();
  expect(suppressionCommand(current, ban, 'public:7', ['C'])).toMatchObject({ targetIds: ['C'] });
});
test('ban has multiple public-name checkboxes and opportunity timing rather than own-turn-once text', () => {
  const html = renderToStaticMarkup(createElement(SuppressionPanel, { view: view(), disabled: false, send: () => true }));
  expect(html.match(/type="checkbox"/g)).toHaveLength(2);
  expect(html).toContain('葵'); expect(html).toContain('楓');
  expect(html).toContain('公開の回答順'); expect(html).toContain('同じ機会に一度');
  expect(html).toContain('通常の行動は使いません');
  expect(html).not.toContain('自分の手番中に一度だけ');
  expect(html).toMatch(/<button disabled="">神と人の差を使う/);
  expect(html).not.toContain('c2-'); expect(html).not.toContain('public:7');
});
test('Blessing explains its exact check, attempt budget and non-restoring death boundary', () => {
  const current = { ...view(), abilityOptions: [{ abilityId: bless, name: '祝福', targetEventId: 'turn:3', targetIds: ['B'] }] };
  const html = renderToStaticMarkup(createElement(SuppressionPanel, { view: current, disabled: true, send: () => true }));
  expect(html).toContain('精神力−5'); expect(html).toContain('自分の手番中に一度');
  expect(html).toContain('取消・判定失敗でも試行は戻りません');
  expect(html).toContain('死亡処理'); expect(html).toContain('復活しても');
  expect(html).toContain('<select'); expect(html).not.toContain('type="checkbox"');
  expect(html).toContain('<fieldset class="panel" disabled="">');
});
test('designation status uses only projected applicability and never infers a hidden exemption', () => {
  const current = { ...view(), legalChoices: [], abilityOptions: [] };
  const html = renderToStaticMarkup(createElement(SuppressionPanel, { view: current, disabled: false, send: () => true }));
  expect(html).toContain('葵'); expect(html).toContain('指定済み・適用状況は非公開');
  for (const forbidden of ['リーア', 'ランスロット', '免除', 'c2-', 'lifeId', '神と人の差を使う']) expect(html).not.toContain(forbidden);
  const empty = { ...current, suppressionTargets: [] };
  expect(renderToStaticMarkup(createElement(SuppressionPanel, { view: empty, disabled: false, send: () => true }))).toBe('');
});
