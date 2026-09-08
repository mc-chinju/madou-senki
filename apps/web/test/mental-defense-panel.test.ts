import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { AbilityChoice } from '../src/game/AbilityPanel.js';
import type { AbilityInputView } from '../src/game/ability-input.js';

const cases = [
  { id: 'c2-p03-r2c1-ab01', name: '魔詩', special: ['同じ陣営', 'EVILの全滅', 'リーア姫の死亡'] },
  { id: 'c2-p06-r1c2-ab01', name: '魅了', special: ['同じ陣営', 'ディアと敵対するものの全滅', 'ディアの死亡'] },
  { id: 'c2-p06-r1c1-ab01', name: '恐怖', special: ['死亡', '他の対象', '宣言済み'] },
] as const;
test.each(cases)('$name explains the complete optional group defense and six-double consequence', entry => {
  const option = { abilityId: entry.id, name: entry.name, targetEventId: 'group-target' };
  const view: AbilityInputView = {
    self: { id: 'B', hand: [], chants: [] }, abilityOptions: [option], legalChoices: ['USE_ABILITY'],
    activeWindow: null, currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [],
    players: { B: { presence: 'active' } },
  };
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view, option, disabled: false, send: () => true }));
  for (const term of ['同じ攻撃', '1回', '精神力−1', '自分への', 'ゾロ目', '攻撃者の次の手番', '6のゾロ目', '反撃', ...entry.special]) expect(html).toContain(term);
  expect(html).not.toContain('<select');
  expect(html).not.toContain('type="checkbox"');
});

import { CurrentGoals } from '../src/game/CurrentGoals.js';
import { PendingFatalNotice } from '../src/game/PendingFatalNotice.js';
import { StatusList } from '../src/game/StatusList.js';
import type { PublicPlayerView } from '@madou/engine';

test('current Dia goal shows the saved enemy factions and replaced protection instead of a printed initial goal', () => {
  const html = renderToStaticMarkup(createElement(CurrentGoals, {
    objective: 'ディアと敵対するものの全滅',
    currentObjective: { kind: 'extinction', enemyFactions: ['GOOD', 'ヴァンミール'] },
    defeatCondition: '愛しいディアの死亡',
  }));
  expect(html).toContain('現在の勝利・敗北条件');
  expect(html).toContain('ディアと敵対するものの全滅');
  expect(html).toContain('GOOD・ヴァンミール');
  expect(html).toContain('愛しいディアの死亡');
  expect(html).not.toContain('リーア姫の死亡');
});
test('Lester keeps explicit EVIL extinction and an empty defeat condition is rendered honestly', () => {
  const html = renderToStaticMarkup(createElement(CurrentGoals, {
    objective: 'EVILの全滅', currentObjective: { kind: 'extinction', enemyFactions: ['EVIL'] }, defeatCondition: '',
  }));
  expect(html).toContain('勝利条件: EVILの全滅');
  expect(html).toContain('敗北条件: なし');
});
function stoppedPlayer(): PublicPlayerView {
  return {
    id: 'A', name: '葵', revealed: false, presence: 'active', pendingFatal: false,
    skipsNextTurn: false, damage: 0, handCount: 2, followers: [], chants: [], chantCount: 0, open: [], attachments: [],
    statuses: [{ kind: 'stopped', timing: 'next-own-seat', expiresOnActorId: 'A' }],
  };
}
test('a mental stop ends at the victim seat arrival and never suggests a recovery check or source card', () => {
  const html = renderToStaticMarkup(createElement(StatusList, { player: stoppedPlayer(), own: true }));
  expect(html).toContain('自分の次の席順が来るまで');
  expect(html).toContain('手番を飛ばす場合も');
  expect(html).toContain('回復判定はありません');
  expect(html).not.toContain('次の回復判定:');
  expect(html).not.toContain('使用者の次の手番');
  expect(html).not.toContain('カード効果');
});
test('the fatal notice names only affected public actors and clears at settlement', () => {
  const players = [{ id: 'A', name: '葵', pendingFatal: true }, { id: 'B', name: '楓', pendingFatal: false }];
  const html = renderToStaticMarkup(createElement(PendingFatalNotice, { players }));
  expect(html).toContain('葵さんへの死亡効果が確定');
  expect(html).toContain('宣言済みの攻撃を解決した後');
  expect(html).not.toContain('楓さんへの死亡');
  expect(html).not.toContain('恐怖');
  expect(html).not.toContain('ガドューラ');
  expect(html).not.toContain('c2-');
  expect(renderToStaticMarkup(createElement(PendingFatalNotice, { players: players.map(player => ({ ...player, pendingFatal: false })) }))).toBe('');
});
