import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { SetupCommandStatus, SetupPanel, SetupPositionChoice, placedLastRound, setupSeatLabel, setupStatusText, type SetupView } from '../src/game/SetupPanel.js';

function input(overrides: Partial<SetupView> = {}): SetupView {
  return {
    phase: 'setup', seatOrder: ['A', 'B', 'C', 'D'],
    pending: { kind: 'initial-followers', round: 1, participantIds: ['A', 'B', 'C', 'D'], readyIds: ['B'] },
    players: { A: { name: '葵' }, B: { name: '楓' }, C: { name: '凛' }, D: { name: '蓮' } },
    legalChoices: ['PLACE_INITIAL_FOLLOWER', 'PASS_SETUP'],
    self: { id: 'A', followers: [], stats: { followerLimit: 2 } },
    ...overrides,
  };
}
const render = (view: SetupView) => renderToStaticMarkup(createElement(SetupPanel, { view }));
const bar = (view: SetupView, canPlace = true, selected?: { name: string; placeable: boolean }) => renderToStaticMarkup(createElement(SetupCommandStatus, { view, canPlace, selected, onShowHand: () => {} }));
const choice = (view: SetupView, canPlace = true) => renderToStaticMarkup(createElement(SetupPositionChoice, { view, canPlace, position: 'back', disabled: false, onPosition: () => {} }));

test('the round shows who is still placing and offers the front line only once something is placed', () => {
  const html = render(input());
  expect(html).toContain('初期配置 ラウンド1');
  expect(html).toContain('手札の従者を置けます');
  expect(html).toContain('全員の準備完了を待っています（未完了: 葵、凛、蓮）');
  expect(html).toContain('「配置を終える」');
  expect(html).not.toContain('従者を置かず進む');
  // The front/back choice sits in the command bar next to the hand, not in the panel above the participants.
  expect(html).not.toContain('前に置く');
  expect(bar(input())).not.toContain('前に置く');
  expect(choice(input())).toBe('');
  const placed = input({ self: { id: 'A', followers: [{}], stats: { followerLimit: 2 } } });
  expect(choice(placed)).toContain('前に置く（最前線）');
  expect(choice(placed, false)).toBe('');
});
test('a later round explains the refill and a finished seat sees no more waiting on itself', () => {
  const later = input({ pending: { kind: 'initial-followers', round: 2, participantIds: ['A'], readyIds: [] } });
  expect(render(later)).toContain('補充で引いた従者があれば置けます');
  const ready = input({ pending: { kind: 'initial-followers', round: 1, participantIds: ['A', 'B'], readyIds: ['A'] } });
  expect(render(ready)).toContain('準備完了しました');
  expect(render(ready)).toContain('未完了: 楓');
});
test('seats outside the round are labelled and given no placement text, and no panel outside setup', () => {
  const view = input({ pending: { kind: 'initial-followers', round: 2, participantIds: ['B'], readyIds: [] } });
  expect(setupSeatLabel(view, 'A')).toBe('対象外');
  expect(setupSeatLabel(view, 'B')).toBe('配置中');
  expect(setupSeatLabel(input(), 'B')).toBe('準備完了');
  expect(render(view)).toContain('このラウンドは対象外です');
  expect(render(view)).not.toContain('「従者を置く」');
  expect(render(input({ phase: 'action', pending: null }))).toBe('');
});
test('the command bar keeps round, ready count and the next step in view beside the hand', () => {
  expect(bar(input())).toContain('初期配置 ラウンド1');
  expect(bar(input())).toContain('準備完了 1 / 4席');
  expect(setupStatusText(input())).toBe('手札の従者を選んで置けます（現在 0 / 2枚）。');
  expect(setupStatusText(input(), { name: '城', placeable: true })).toContain('「城」を選択中');
  expect(setupStatusText(input(), { name: '催眠', placeable: false })).toBe('「催眠」は従者として置けません。');
  const full = input({ self: { id: 'A', followers: [{}, {}], stats: { followerLimit: 2 } } });
  expect(setupStatusText(full, { name: '城', placeable: false })).toContain('上限の2枚');
  expect(setupStatusText(full, undefined, false)).toBe('従者は上限の2枚です。「配置を終える」で準備完了にしてください。');
  expect(setupStatusText(input(), undefined, false)).toContain('置ける従者はありません');
  const later = input({ pending: { kind: 'initial-followers', round: 2, participantIds: ['A'], readyIds: [] } });
  expect(setupStatusText(later)).toBe('手札を補充しました。引いた従者があれば置けます（現在 0 / 2枚）。');
  // Round 2 says the refill happened (count from the public log) and that finishing is needed once more.
  const refilled = input({ pending: { kind: 'initial-followers', round: 2, participantIds: ['A'], readyIds: [] }, self: { id: 'A', followers: [{}], stats: { followerLimit: 2 } },
    logs: [{ type: 'FOLLOWER_PLACED', actorId: 'B' }, { type: 'FOLLOWER_PLACED', actorId: 'A' }, { type: 'SETUP_PASSED', actorId: 'B' }, { type: 'SETUP_PASSED', actorId: 'A' }] });
  expect(placedLastRound(refilled)).toBe(1);
  expect(setupStatusText(refilled, undefined, false)).toBe('補充で1枚引きました。置ける従者はありません（現在 1 / 2枚）。もう一度「配置を終える」で準備完了にしてください。');
  expect(setupStatusText(input({ self: { id: 'A', followers: [{}], stats: { followerLimit: 2 } } }), undefined, false)).not.toContain('補充');
  // Only the round just before this one counts: earlier rounds stop at the previous pass, and what this round already placed is not a refill.
  const third = input({ pending: { kind: 'initial-followers', round: 3, participantIds: ['A'], readyIds: [] }, self: { id: 'A', followers: [{}, {}], stats: { followerLimit: 3 } },
    logs: [{ type: 'FOLLOWER_PLACED', actorId: 'A' }, { type: 'SETUP_PASSED', actorId: 'A' }, { type: 'FOLLOWER_PLACED', actorId: 'A' }, { type: 'SETUP_PASSED', actorId: 'A' }, { type: 'FOLLOWER_PLACED', actorId: 'A' }] });
  expect(placedLastRound(third)).toBe(1);
  expect(bar(input())).toContain('手札へ');
  const ready = input({ pending: { kind: 'initial-followers', round: 1, participantIds: ['A', 'B', 'C'], readyIds: ['A'] }, legalChoices: [] });
  expect(setupStatusText(ready)).toBe('準備完了しました。楓、凛の配置を待っています。');
  expect(choice(ready)).toBe('');
  expect(bar(ready)).not.toContain('手札へ');
  expect(render(ready)).not.toContain('「従者を置く」');
  const outside = input({ pending: { kind: 'initial-followers', round: 2, participantIds: ['B'], readyIds: [] }, legalChoices: [] });
  expect(setupStatusText(outside)).toBe('このラウンドは対象外です。楓の配置を待っています。');
  expect(bar(input({ phase: 'action', pending: null }))).toBe('');
});
