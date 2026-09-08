import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { PlayerView } from '@madou/engine';
import { AbilityChoice } from '../src/game/AbilityPanel.js';
import type { AbilityInputView } from '../src/game/ability-input.js';
import { ReceivedTechniqueSummary } from '../src/game/ReceivedTechniqueSummary.js';

test.each([
  ['c2-p03-r1c1-ab02', '魔法抵抗', ['魔法ダメージ', '半減を予約', '従者', '抵抗失敗', '切り捨て', '確定前', '停止']],
  ['c2-p03-r1c2-ab01', '光の加護', ['精神力−3', 'サイコロ1個', '効果Lv', '0以下', 'この1発']],
  ['c2-p07-r1c1-ab01', '光の盾', ['精神力−5', '自分の戦士Lv以下', '予約', '白銀の鎧とは別']],
  ['c2-p05-r2c2-ab02', '魔導王の威厳', ['精神力−5', 'この1発', '反撃扱い', '反撃禁止', '距離']],
] as const)('%s %s describes its saved optional defense', (abilityId, name, terms) => {
  const option = { abilityId, name, targetEventId: 'event' };
  const view: AbilityInputView = { self: { id: 'B', hand: [], chants: [] }, abilityOptions: [option], legalChoices: ['USE_ABILITY'], activeWindow: null,
    currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [], players: { B: { presence: 'active' } } };
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view, option, disabled: false, send: () => true }));
  for (const term of terms) expect(html).toContain(term);
  expect(html).not.toContain('<select'); expect(html).not.toContain('type="checkbox"'); expect(html).toContain(`${name}を使う`);
});
function attack(): NonNullable<PlayerView['currentAttack']> {
  const technique = { effectLevel: 5, damage: 5, attributes: ['魔', '白'], destructionEffects: [], beastIgnore: false };
  return { groupId: 'private-group', actionId: 'action', attackerId: 'A', targetIds: ['B', 'C'], hitIndex: 0, targetId: 'C', reason: 'hit', technique,
    defenseRestrictions: { maaiProhibited: false, evadeProhibited: false, counterProhibited: false }, targets: [
      { actorId: 'B', hits: [{ index: 0, defended: false, hit: true, technique: { ...technique }, bodyDamage: { directDamage: 2, resistanceDamage: 0, total: 2 } }] },
      { actorId: 'C', hits: [{ index: 0, defended: false, hit: false, technique }] },
    ] };
}
function render(value: PlayerView['currentAttack']) { return renderToStaticMarkup(createElement(ReceivedTechniqueSummary, { attack: value, names: { A: '葵', B: '楓', C: '凛' } })); }
test('final body damage takes precedence while another target still displays incoming damage', () => {
  const html = render(attack());
  expect(html).toContain('本人への確定ダメージ 2'); expect(html).toContain('効果Lv 5 / ダメージ 5');
  expect(html).toContain('技による損傷 2'); expect(html).toContain('抵抗失敗による追加 0'); expect(html).not.toContain('確定ダメージ 5');
});
test('a null direct technique retains no direct damage while actual resistance damage is shown separately', () => {
  const value = attack(); value.targets[0]!.hits[0]!.bodyDamage = { directDamage: null, resistanceDamage: 5, total: 5 };
  value.targets[0]!.hits[0]!.technique!.damage = null;
  const html = render(value); expect(html).toContain('本人への確定ダメージ 5'); expect(html).toContain('技による損傷 なし'); expect(html).toContain('抵抗失敗による追加 5');
});
test('a reflected ability shows original public card provenance without inventing a second card payment or private identity', () => {
  const value = attack(); value.reflection = { source: 'ability', actorId: 'B', sourceCardInstanceId: 'a2-p14-r1c2' };
  const html = render(value); expect(html).toContain('楓さんが白光を跳ね返しています'); expect(html).toContain('元の攻撃札を追加で消費することはありません');
  expect(html).not.toContain('魔導王'); expect(html).not.toContain('c2-p05'); expect(html).not.toContain('private-group');
});
test('zero final damage remains numeric zero rather than falling back to the original incoming value', () => {
  const value = attack(); value.targets[0]!.hits[0]!.bodyDamage = { directDamage: 0, resistanceDamage: 0, total: 0 };
  const html = render(value); expect(html).toContain('本人への確定ダメージ 0'); expect(html).toContain('技による損傷 0');
});
