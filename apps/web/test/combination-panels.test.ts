import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { AttackCostFields, CombinationPanel } from '../src/game/CombinationPanel.js';
import type { CombinationInputView } from '../src/game/combination-input.js';

function view(): CombinationInputView {
  return { self: { id: 'A', hand: ['a2-p09-r1c1', 'a2-p08-r1c1', 'a2-p23-r1c2'], chants: [] }, legalChoices: ['ATTACK'], activeWindow: null,
    combinationOptions: [{ cardInstanceId: 'a2-p09-r1c1', coSources: [{ cardInstanceId: 'a2-p08-r1c1', dedicated: false }] }],
    advanceCostOptions: [], techniqueDecision: null, groupDefenseOptions: [] };
}
const noOp = () => {};
test('co-source selector offers an explicit no-combination choice and names the real owned source', () => {
  const markup = renderToStaticMarkup(createElement(AttackCostFields, { view: view(), cardId: 'a2-p09-r1c1', dedicated: true, coSource: undefined, advances: [], disabled: false, onCoSource: noOp, onAdvances: noOp }));
  expect(markup).toContain('組み合わせる技');
  expect(markup).toContain('組み合わせない');
  expect(markup).toContain('黒翼飛翔剣');
  expect(markup).not.toContain('checked=""');
});
test('co-source selector labels chanted and placed sources while leaving hand sources unlabeled', () => {
  const chanted = 'a2-p08-r1c1';
  const placed = 'a2-p20-r3c1';
  const hand = 'a2-p08-r3c1';
  const input: CombinationInputView = { ...view(), self: { ...view().self, hand: ['a2-p09-r1c1', hand], chants: [{ cardInstanceId: chanted }], followers: [{ cardInstanceId: placed }] },
    combinationOptions: [{ cardInstanceId: 'a2-p09-r1c1', coSources: [
      { cardInstanceId: chanted, dedicated: false },
      { cardInstanceId: placed, dedicated: true },
      { cardInstanceId: hand, dedicated: false },
    ] }] };
  const markup = renderToStaticMarkup(createElement(AttackCostFields, { view: input, cardId: 'a2-p09-r1c1', dedicated: true, coSource: undefined, advances: [], disabled: false, onCoSource: noOp, onAdvances: noOp }));
  expect(markup).toContain('黒翼飛翔剣（詠唱中）');
  expect(markup).toContain('グリフォン（配置中）');
  expect(markup).toContain('裏天空剣（通常）');
  expect(markup).not.toContain('裏天空剣（詠唱中）');
  expect(markup).not.toContain('裏天空剣（配置中）');
});
test('post-hit payment starts with no costs selected and exposes an explicit decline', () => {
  const input = { ...view(), legalChoices: ['PAY_HIT_ADVANCES', 'PASS'], activeWindow: { pendingActorId: 'A' }, techniqueDecision: { kind: 'hit-advance' as const, actorId: 'A', groupId: 'g1', sourceCardInstanceId: 'a2-p08-r1c2', cardInstanceIds: ['a2-p23-r1c2'] } };
  const markup = renderToStaticMarkup(createElement(CombinationPanel, { view: input, names: { A: '葵' }, disabled: false, send: () => true }));
  expect(markup).toContain('消費する踏み込み');
  expect(markup).toContain('追加しない');
  expect(markup).toContain('disabled=""');
  expect(markup).not.toContain('checked=""');
  expect(markup).not.toContain('PAY_HIT_ADVANCES');
});
test('Lia intervention names the whole offered group without a target selector', () => {
  const input = { ...view(), self: { ...view().self, hand: ['a2-p16-r3c3'] }, legalChoices: ['PLAY_GROUP_DEFENSE'], activeWindow: { pendingActorId: 'A' }, groupDefenseOptions: [{ cardInstanceId: 'a2-p16-r3c3', groupId: 'g9', targetIds: ['B', 'C'] }] };
  const markup = renderToStaticMarkup(createElement(CombinationPanel, { view: input, names: { B: '紅', C: '翠' }, disabled: false, send: () => true }));
  expect(markup).toContain('紅・翠');
  expect(markup).toContain('光王陣でまとめて防ぐ');
  expect(markup).not.toContain('<select');
  expect(markup).not.toContain('PLAY_GROUP_DEFENSE');
  expect(renderToStaticMarkup(createElement(CombinationPanel, { view: view(), names: {}, disabled: false, send: () => true }))).toBe('');
});

test('next-turn skip is visible even without an ordinary status and distinguishes a whole skipped turn', async () => {
  const { StatusList } = await import('../src/game/StatusList.js');
  const { createGame, viewFor } = await import('@madou/engine');
  const state = createGame(['A', 'B', 'C', 'D'].map(id => ({ id, name: id })), { now: 1, dice: Array(100).fill(1), random: Array(4096).fill(0.3) }, { startingSeat: 0 });
  const player = { ...viewFor(state, 'A').players.A!, statuses: [], skipsNextTurn: true };
  const markup = renderToStaticMarkup(createElement(StatusList, { player, own: true }));
  expect(markup).toContain('次の手番を飛ばします');
  expect(markup).toContain('回復判定');
  expect(renderToStaticMarkup(createElement(StatusList, { player: { ...player, skipsNextTurn: false } }))).toBe('');
});
