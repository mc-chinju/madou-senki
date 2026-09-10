import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { AbilityChoice } from '../src/game/AbilityPanel.js';
import type { AbilityInputView } from '../src/game/ability-input.js';
import type { PlayerView } from '@madou/engine';
import { MaaiDefenseSummary } from '../src/game/MaaiDefenseSummary.js';

function progress(): NonNullable<PlayerView['maaiDefense']> {
  return { groupId: 'group', attackerId: 'A', hitIndex: 1, targetId: 'B', responding: false, sharedAdvances: 0,
    targets: [{ actorId: 'B', hitIndex: 1, required: 3, prohibited: false, carried: 0, submitted: 2, effective: 2, remaining: 1, closed: false }] };
}
const names = { A: '葵', B: '楓', C: '凛' };
function render(value: PlayerView['maaiDefense']) { return renderToStaticMarkup(createElement(MaaiDefenseSummary, { progress: value, names })); }
test('distance progress identifies the current target and hit and explains paid versus effective cards', () => {
  const html = render(progress());
  for (const value of ['楓さんの防御', '楓さん・2発目', '必要3枚・有効2枚・あと1枚', '今回出した間合い2枚', '前の応酬から有効な間合い0枚']) expect(html).toContain(value);
  expect(html).toContain('aria-live="polite"'); expect(html).not.toContain('group'); expect(html).not.toContain('<button');
});
test('shared attacker response shows each target independently and does not announce zero remaining as completed evasion', () => {
  const value = progress(); value.responding = true; value.targetId = null; value.sharedAdvances = 1;
  value.targets.push({ ...value.targets[0]!, actorId: 'C', required: 2, submitted: 3, effective: 2, remaining: 0 });
  const html = render(value);
  for (const text of ['葵さんの踏み込みの判断待ち', '今回の踏み込み1枚は全対象で共有します', '楓さん・2発目', '凛さん・2発目', '必要2枚・有効2枚・あと0枚', '回避はまだ確定していません']) expect(html).toContain(text);
});
test('server progress after a completed exchange retains prior effective cards without reconstructing totals', () => {
  const value = progress(); value.targets[0] = { ...value.targets[0]!, carried: 2, submitted: 0, effective: 2, remaining: 1 };
  const html = render(value);
  expect(html).toContain('前の応酬から有効な間合い2枚'); expect(html).toContain('今回出した間合い0枚'); expect(html).toContain('必要3枚・有効2枚・あと1枚');
});
test('prohibited and completed rows do not suggest paying more distance cards', () => {
  const value = progress(); value.targets[0]!.prohibited = true;
  value.targets.push({ ...value.targets[0]!, actorId: 'C', closed: true });
  const html = render(value);
  expect(html).toContain('間合いで回避できません'); expect(html).toContain('この発の通常防御は終了しています'); expect(html).not.toContain('あと1枚');
});
test('the progress panel disappears outside the current exchange', () => { expect(render(null)).toBe(''); });

test.each([
  { abilityId: 'c2-p02-r2c1-ab01', name: '瞬風', terms: ['戦士技', '間合いを1枚追加', '元の必要枚数'] },
  { abilityId: 'c2-p03-r2c2-ab03', name: '黒弓', terms: ['弓技', '見切り不可', '効果Lv+1', 'ダメージ+2', 'まとめて'] },
])('$name explains its complete optional package without extra costs', entry => {
  const option = { abilityId: entry.abilityId, name: entry.name, targetEventId: 'event' };
  const view: AbilityInputView = { self: { id: 'A', hand: [], chants: [] }, abilityOptions: [option], legalChoices: ['USE_ABILITY'], activeWindow: null,
    currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [], players: { A: { presence: 'active' } } };
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view, option, disabled: false, send: () => true }));
  for (const term of entry.terms) expect(html).toContain(term);
  expect(html).not.toContain('type="checkbox"'); expect(html).not.toContain('<select');
  expect(html).toContain(`${entry.name}を使う`);
});
