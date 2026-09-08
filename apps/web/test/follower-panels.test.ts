import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { FollowerEditor } from '../src/game/FollowerEditor.js';
import { FollowerDefenseFields } from '../src/game/FollowerDefenseFields.js';
import type { FollowerInputView } from '../src/game/follower-input.js';

function input(): FollowerInputView {
  return { self: { id: 'A', hand: ['a2-p20-r3c2', 'a2-p19-r1c3'], followers: [{ cardInstanceId: 'a2-p21-r2c1' }, { cardInstanceId: 'a2-p21-r1c2' }], stats: { followerLimit: 3 } },
    legalChoices: ['ARRANGE_FOLLOWERS'], activeWindow: null,
    followerPlacementOptions: { placeableCardInstanceIds: ['a2-p19-r1c3'], removableCardInstanceIds: ['a2-p21-r1c2'] }, followerDefenseOptions: [{ cardInstanceId: 'a2-p21-r1c2' }] };
}
test('arrangement explains the locked placed source, permits its order controls and omits an ineligible castle', () => {
  const html = renderToStaticMarkup(createElement(FollowerEditor, { view: input(), disabled: false, confirm: () => {} }));
  const lockedRow = html.match(/<li[^>]*>[\s\S]*?闇の聖女[\s\S]*?<\/li>/)![0];
  expect(lockedRow).toContain('任意に外せません');
  expect(lockedRow).toMatch(/<button[^>]*disabled=""[^>]*>外す<\/button>/);
  expect(lockedRow).toMatch(/<button(?![^>]*disabled)[^>]*>後ろへ<\/button>/);
  expect(html).toContain('砦'); expect(html).not.toContain('アルケミア城');
});
test('follower dedication is an explicit unchecked choice in only the owner normal defense window', () => {
  const view = { ...input(), legalChoices: ['START_FOLLOWERS'], activeWindow: { kind: 'normal-defense', pendingActorId: 'A' } };
  const html = renderToStaticMarkup(createElement(FollowerDefenseFields, { view, selected: [], disabled: false, onChange: () => {} }));
  expect(html).toContain('王立騎士団の専用効果を使う'); expect(html).not.toContain('checked=""');
  expect(html).toContain('選ばなければ通常の従者として受けます');
  const other = renderToStaticMarkup(createElement(FollowerDefenseFields, { view: { ...view, activeWindow: { ...view.activeWindow, pendingActorId: 'B' } }, selected: [], disabled: false, onChange: () => {} }));
  expect(other).toBe('');
});
