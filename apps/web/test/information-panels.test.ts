import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { InspectionPanel } from '../src/game/InspectionPanel.js';
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
