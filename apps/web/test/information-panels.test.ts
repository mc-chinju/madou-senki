import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { PlayerView } from '@madou/engine';
import { InformationHistoryPanel } from '../src/game/InformationHistoryPanel.js';
import { InspectionPanel } from '../src/game/InspectionPanel.js';
import { TurnChoiceCardPanel } from '../src/game/TurnChoiceCardPanel.js';
import { WishPanel } from '../src/game/WishPanel.js';
import { DrawControl, RevealControl, SpiritExpiryNotice } from '../src/game/OptionalTurnControls.js';
import type { InspectionInputView } from '../src/game/information-input.js';

test('draw and voluntary reveal expose unchecked whole choices while preserving ordinary commands', () => {
  const props = { disabled: false, send: () => true };
  const draw = renderToStaticMarkup(createElement(DrawControl, { ...props, view: { legalChoices: ['CHOOSE_DRAW'], drawAbilityOptions: [{ abilityId: 'c2-p01-r2c2-ab02', name: 'なになに' }] } }));
  expect(draw).toContain('1枚の代わりに2枚');
  expect(draw).not.toContain('checked=""');
  expect(draw).toContain('カードを引かない');
  const reveal = renderToStaticMarkup(createElement(RevealControl, { ...props, view: { legalChoices: ['REVEAL_CHARACTER'], revealAbilityOptions: [{ abilityId: 'c2-p04-r2c1-ab03', name: '本当の力' }] } }));
  expect(reveal).toContain('基礎精神力を12');
  expect(reveal).not.toContain('checked=""');
  expect(reveal).toContain('正体の公開は戻りません');
  expect(renderToStaticMarkup(createElement(RevealControl, { ...props, view: { legalChoices: [] } }))).toBe('');
});
function view(): InspectionInputView {
  return { self: { id: 'A' }, legalChoices: ['CHOOSE_INSPECTION', 'PASS'], activeWindow: { kind: 'private-inspection', pendingActorId: 'A' },
    inspection: { decisionId: 'inspection-9', actorId: 'A', targetId: 'B', zone: 'hand', cards: [{ position: 0, cardInstanceId: 'a2-p14-r1c2' }], discardMode: 'one', choices: ['finish', 'discard-one'] } };
}
const inspect = (state: InspectionInputView) => renderToStaticMarkup(createElement(InspectionPanel, { view: state, names: { A: '葵', B: '楓' }, disabled: false, send: () => true, onInspect: () => {} }));
test('inspection displays only the owner snapshot and leaves the other viewer with a generic wait', () => {
  const own = inspect(view());
  expect(own).toContain('楓さんの手札');
  expect(own).toContain('白光');
  expect(own).toMatch(/<button disabled="">選んだ1枚を捨てさせる/);
  const other = inspect({ ...view(), self: { id: 'B' }, inspection: null });
  expect(other).toContain('葵さんの確認を待っています');
  expect(other).not.toContain('白光');
  expect(other).not.toContain('inspection-9');
  expect(inspect({ ...view(), self: { id: 'B' } })).not.toContain('白光');
});
test('a saved inspection remains visible during a nested child but cannot be completed through it', () => {
  const child = inspect({ ...view(), legalChoices: ['PASS'], activeWindow: { kind: 'declaration', pendingActorId: 'A' } });
  expect(child).toContain('白光');
  expect(child).toContain('割り込みの解決を待っています');
  expect(child).toMatch(/<button class="secondary" disabled="">確認を終える/);
});
test('spirit expiry explains the saved turn end and suppression without capping the final stat', () => {
  const active = renderToStaticMarkup(createElement(SpiritExpiryNotice, { names: { B: '楓' }, value: { expiresOnActorId: 'B', active: true } }));
  expect(active).toContain('楓さんの手番終了まで');
  expect(active).toContain('他の有効な修正');
  const suppressed = renderToStaticMarkup(createElement(SpiritExpiryNotice, { names: { B: '楓' }, value: { expiresOnActorId: 'B', active: false } }));
  expect(suppressed).toContain('現在は効果が働いていません');
});

/** What a seat has privately learned is knowledge it keeps, not a line in the record. The record is read
 *  through a window of the newest lines now, so a panel that read its history from the record would empty
 *  itself while the table played on — with nothing on screen to say that anything had been dropped. */
test('the histories of what a seat confirmed and took are read from what it knows, not from the record', () => {
  const players = { A: { name: '葵' }, B: { name: '楓' } };
  // A record window that no longer reaches back to any of it: the panels must not be looking here.
  const view = {
    players, self: { id: 'A' }, logs: [{ id: 400, at: 0, type: 'REST', actorId: 'B', count: 1 }], privateLogs: [], logStart: 1,
    inspectionHistory: [
      { decisionId: 'inspection-9', actorId: 'A', targetId: 'B', zone: 'character', cards: [], characterId: 'c2-p04-r2c2', discardMode: 'none', choices: ['finish'] },
      { decisionId: 'inspection-4', actorId: 'A', targetId: 'B', zone: 'all', cards: [{ zone: 'hand', position: 0, cardInstanceId: 'a2-p14-r1c2' }], discardMode: 'none', choices: ['finish'] },
    ],
    wishHistory: [{ eventId: 12, actorId: 'A', ownerId: 'B', cardInstanceId: 'a2-p14-r1c2' }],
    turnChoiceCardOptions: [], wishOptions: [], activeWindow: null, peaceExpiries: [],
  } as unknown as PlayerView;
  const identity = renderToStaticMarkup(createElement(TurnChoiceCardPanel, { view, disabled: false, send: () => true }));
  expect(identity).toContain('自分だけの正体確認履歴');
  expect(identity).toMatch(/<li>楓: [^<]+<\/li>/);
  const wish = renderToStaticMarkup(createElement(WishPanel, { view, disabled: false, send: () => true }));
  expect(wish).toContain('祈願の取得履歴');
  expect(wish).toContain('葵さんが白光を取得しました');
  // An identity is not a row of cards, so the revelation panel keeps to the confirmations that named cards.
  const revelation = renderToStaticMarkup(createElement(InformationHistoryPanel, { view }));
  expect(revelation).toContain('自分だけの啓示の履歴');
  expect(revelation.match(/<details>/g)).toHaveLength(1);
  expect(revelation).toContain('手札 1：白光');
  // Nothing of the kind to show is still nothing: an empty history draws no panel at all.
  const empty = { ...view, inspectionHistory: [], wishHistory: [] } as unknown as PlayerView;
  expect(renderToStaticMarkup(createElement(TurnChoiceCardPanel, { view: empty, disabled: false, send: () => true }))).toBe('');
  expect(renderToStaticMarkup(createElement(WishPanel, { view: empty, disabled: false, send: () => true }))).toBe('');
  expect(renderToStaticMarkup(createElement(InformationHistoryPanel, { view: empty }))).toBe('');
});
