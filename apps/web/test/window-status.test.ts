import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { WindowStatus, decisionPanelKey, showsWindowSeatLabel, standingScope, windowSeatLabel, type WindowStatusView } from '../src/game/WindowStatus.js';

function input(overrides: Partial<WindowStatusView> = {}): WindowStatusView {
  return {
    activeWindow: { windowId: 'w-1', windowRevision: 0, kind: 'declaration', pendingActorId: 'B', reason: 'declaration',
      participantIds: ['A', 'B', 'C', 'D'], passedActorIds: ['A'], passAhead: true },
    standingPasses: [],
    legalChoices: ['PASS', 'PASS_ACTION_THROUGH'],
    players: { A: { name: '葵' }, B: { name: '楓' }, C: { name: '凛' }, D: { name: '蓮' } },
    self: { id: 'D' },
    ...overrides,
  };
}
const render = (view: WindowStatusView) => renderToStaticMarkup(createElement(WindowStatus, { view, disabled: false, send: () => true }));

test('a respondent without priority is offered a pass and the whole action', () => {
  const html = render(input());
  expect(html).toContain('いま 楓さん');
  expect(html).toContain('回答 1 / 4席');
  expect(html).toContain('カードを出す番はまだですが、先にパスできます。');
  // The viewer's own name is not part of the seats it is waiting for.
  expect(html).toContain('未回答: 凛');
  expect(html).not.toContain('未回答: 凛、蓮');
  expect(html).toContain('パス（この確認だけ）');
  expect(html).toContain('この行動は任せる');
  expect(html).toContain('出目や防御を見てから割り込むことはできなくなり、この行動に続く回収の回答もまとめて済ませます');
});

test('a seat that left the action sees only the way back', () => {
  const html = render(input({ standingPasses: [{ actorId: 'C', scope: 'action' }, { actorId: 'D', scope: 'action' }], legalChoices: ['CANCEL_PASS_THROUGH'],
    activeWindow: { ...input().activeWindow!, passedActorIds: ['A', 'C', 'D'] } }));
  expect(html).toContain('この行動は任せています。');
  // The viewer is one of them; only the other seats are worth naming.
  expect(html).toContain('この行動を任せている席: 凛');
  expect(html).toContain('任せるのをやめる');
  expect(html).not.toContain('パス（この確認だけ）');
});

test('the whole turn is offered beside the whole action, and says what it takes in', () => {
  const html = render(input());
  expect(html).toContain('この手番は任せる');
  expect(html).toContain('この手番のあいだ、割り込みの機会は流れます');
  expect(html).toContain('この手番に続く回収の回答もまとめて済ませます');
});

test('the range each seat left behind is the one the status line names', () => {
  const view = input({ standingPasses: [{ actorId: 'C', scope: 'action' }, { actorId: 'D', scope: 'turn' }], legalChoices: ['CANCEL_PASS_THROUGH'],
    activeWindow: { ...input().activeWindow!, passedActorIds: ['A', 'C', 'D'] } });
  const html = render(view);
  expect(html).toContain('この手番は任せています。');
  expect(html).not.toContain('この行動は任せています。');
  expect(html).toContain('この行動を任せている席: 凛');
  expect(standingScope(view, 'C')).toBe('action');
  expect(standingScope(view, 'D')).toBe('turn');
  expect(standingScope(view, 'A')).toBeUndefined();
});

test('the seat holding priority is told so and never gets the pass-ahead button', () => {
  const html = render(input({ self: { id: 'B' }, legalChoices: ['PASS', 'PLAY_REACTION', 'PASS_ACTION_THROUGH'] }));
  expect(html).toContain('あなたの判断です');
  expect(html).not.toContain('パス（この確認だけ）');
  expect(html).toContain('この行動は任せる');
});

test('a reclaim answer keeps the wording used for declining a reclaim', () => {
  const html = render(input({ activeWindow: { ...input().activeWindow!, kind: 'reclaim' } }));
  expect(html).toContain('回収せずに進む');
  expect(html).toContain('この行動に続く回収の回答もまとめて済ませます');
});

test('windows that keep priority strictly show no roster', () => {
  expect(render(input({ activeWindow: { ...input().activeWindow!, kind: 'normal-defense', passAhead: false } }))).toBe('');
  expect(render(input({ activeWindow: null }))).toBe('');
});

test('a seat that left the action can take it back from a window it is not asked in', () => {
  const html = render(input({ standingPasses: [{ actorId: 'D', scope: 'action' }], legalChoices: ['CANCEL_PASS_THROUGH'],
    activeWindow: { ...input().activeWindow!, kind: 'normal-defense', passAhead: false, participantIds: ['B'], passedActorIds: [] } }));
  expect(html).toContain('この行動は任せています。');
  expect(html).toContain('任せるのをやめる');
  expect(html).toContain('次の確認から聞き直します');
});

test('leaving the window keeps the answer it already gave', () => {
  const html = render(input({ self: { id: 'A' }, legalChoices: [] }));
  expect(html).toContain('この確認はパス済みです。次の確認から聞き直します。');
});

test('a standing pass is the only seat state shown on a window that keeps priority', () => {
  const view = input({ standingPasses: [{ actorId: 'C', scope: 'action' }], activeWindow: { ...input().activeWindow!, kind: 'normal-defense', passAhead: false, participantIds: ['B'] } });
  expect(showsWindowSeatLabel(view, 'C')).toBe(true);
  expect(windowSeatLabel(view, 'C')).toBe('任せる');
  expect(showsWindowSeatLabel(view, 'A')).toBe(false);
  expect(showsWindowSeatLabel(input(), 'A')).toBe(true);
});

test('a bystander with nothing to press still sees who is answering', () => {
  const html = render(input({ self: { id: 'X' }, legalChoices: [] }));
  expect(html).toContain('いま 楓さん');
  expect(html).not.toContain('button');
});

test('each seat carries its public answer state', () => {
  const view = input({ standingPasses: [{ actorId: 'C', scope: 'action' }] });
  expect(windowSeatLabel(view, 'A')).toBe('回答済み');
  expect(windowSeatLabel(view, 'B')).toBe('判断中');
  expect(windowSeatLabel(view, 'C')).toBe('任せる');
  expect(windowSeatLabel({ ...view, activeWindow: { ...view.activeWindow!, participantIds: ['A', 'B', 'C'] } }, 'D')).toBe('対象外');
});

test('another seat passing does not remount the decision panel', () => {
  const before = input();
  const after = input({ activeWindow: { ...before.activeWindow!, passedActorIds: ['A', 'D'] } });
  expect(decisionPanelKey(after)).toBe(decisionPanelKey(before));
  // An intervention moves the window generation, so the panel is rebuilt for the new situation.
  expect(decisionPanelKey(input({ activeWindow: { ...before.activeWindow!, windowRevision: 1 } }))).not.toBe(decisionPanelKey(before));
});
