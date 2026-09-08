import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { PlayerView } from '@madou/engine';
import { AbilityChoice } from '../src/game/AbilityPanel.js';
import type { AbilityInputView } from '../src/game/ability-input.js';
import { ReceivedTechniqueSummary } from '../src/game/ReceivedTechniqueSummary.js';

test.each([
  ['c2-p01-r1c1-ab01', '絶対結界', ['効果Lv5以下', '従者で受ける前', '5点以下', 'ダメージのない技']],
  ['c2-p02-r1c2-ab01', '光の結界', ['自分が受ける魔法技', '効果Lvを1下げ', 'ダメージは変わりません']],
  ['c2-p02-r1c2-ab02', 'ミスリルのローブ', ['効果Lv3以下', '先に予約', '後から効果Lv']],
  ['c2-p02-r2c2-ab01', '白銀の鎧', ['黒技の効果Lvを1下げ', 'その後', '効果Lv4以下', 'まとめて']],
  ['c2-p03-r1c1-ab01', 'ミスリルの鎧', ['効果Lv3以下', '先に予約']],
  ['c2-p03-r2c2-ab01', '闇の結界', ['自分が受ける魔法技', '効果Lvを1下げ', 'ダメージは変わりません']],
  ['c2-p04-r1c1-ab01', '氷の結界', ['炎・水', '戦士技・魔法技', '無効']],
  ['c2-p05-r2c1-ab01', '黒騎士の鎧', ['効果Lv4以下の戦士技', '先に予約']],
  ['c2-p05-r2c2-ab01', '暗黒の鎧', ['効果Lv5以下', '先に予約']],
  ['c2-p06-r2c1-ab01', '炎の結界', ['炎・水', '戦士技・魔法技', '無効']],
  ['c2-p07-r1c2-ab01', '巨神', ['効果Lv5以下', '先に予約']],
] as const)('%s %s explains its complete received-defense package', (abilityId, name, terms) => {
  const option = { abilityId, name, targetEventId: 'private-event' };
  const view: AbilityInputView = { self: { id: 'B', hand: [], chants: [] }, abilityOptions: [option], legalChoices: ['USE_ABILITY'], activeWindow: null,
    currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [], players: { B: { presence: 'active' } } };
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view, option, disabled: false, send: () => true }));
  for (const term of terms) expect(html).toContain(term);
  expect(html).toContain(`${name}を使う`); expect(html).not.toContain('<select'); expect(html).not.toContain('type="checkbox"');
});

function attack(): NonNullable<PlayerView['currentAttack']> {
  const technique = { effectLevel: 6, damage: 8, attributes: ['魔', '地'], destructionEffects: [], beastIgnore: false };
  return { groupId: 'internal-group', actionId: 'action', attackerId: 'A', targetIds: ['B', 'C'], hitIndex: 0, targetId: 'B', reason: 'normal-defense', technique,
    defenseRestrictions: { maaiProhibited: false, evadeProhibited: false, counterProhibited: false },
    targets: [{ actorId: 'B', hits: [{ index: 0, defended: false, hit: false, technique: { ...technique, effectLevel: 5 } }] },
      { actorId: 'C', hits: [{ index: 0, defended: false, hit: false, technique }] }] };
}
function render(value: PlayerView['currentAttack']) { return renderToStaticMarkup(createElement(ReceivedTechniqueSummary, { attack: value, names: { A: '葵', B: '楓', C: '凛' } })); }
test('received values show independent target numbers without substituting the shared original', () => {
  const html = render(attack());
  for (const value of ['楓さん・1発目', '凛さん・1発目', '効果Lv 5 / ダメージ 8', '効果Lv 6 / ダメージ 8', '通常防御中のダメージは、従者のHPで軽減する前の値です', 'aria-live="polite"']) expect(html).toContain(value);
  expect(html).not.toContain('internal-group'); expect(html).not.toContain('闇の結界'); expect(html).not.toContain('<button');
});
test('a later null-damage hit and a defended hit retain their exact server values', () => {
  const value = attack(); value.targets[0]!.hits[0]!.defended = true;
  value.targets[0]!.hits.push({ index: 1, defended: false, hit: false, technique: { ...value.technique, effectLevel: 7, damage: null } });
  const html = render(value); expect(html).toContain('楓さん・2発目'); expect(html).toContain('効果Lv 7 / ダメージ なし'); expect(html).toContain('防御済み'); expect(html).not.toContain('結界で無効');
});
test('received context disappears once no attack is projected', () => { expect(render(null)).toBe(''); });
test('later follower damage updates stay qualified by the current processing point', () => {
  const value = attack(); value.reason = 'follower-after'; value.targets[0]!.hits[0]!.technique!.damage = 7;
  const html = render(value); expect(html).toContain('効果Lv 5 / ダメージ 7'); expect(html).toContain('現在の処理時点の値');
  expect(html).not.toContain('軽減はまだ含みません');
});
