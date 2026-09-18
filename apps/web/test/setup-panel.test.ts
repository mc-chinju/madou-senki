import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { SetupPanel, setupSeatLabel, type SetupView } from '../src/game/SetupPanel.js';

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
const render = (view: SetupView) => renderToStaticMarkup(createElement(SetupPanel, { view, position: 'back', disabled: false, onPosition: () => {} }));

test('the round shows who is still placing and offers the front line only once something is placed', () => {
  const html = render(input());
  expect(html).toContain('初期配置 ラウンド1');
  expect(html).toContain('手札の従者を置けます');
  expect(html).toContain('全員の準備完了を待っています（未完了: 葵、凛、蓮）');
  expect(html).not.toContain('前に置く');
  expect(render(input({ self: { id: 'A', followers: [{}], stats: { followerLimit: 2 } } }))).toContain('前に置く（最前線）');
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
  expect(render(view)).toContain('あなたは配置できません');
  expect(render(input({ phase: 'action', pending: null }))).toBe('');
});
