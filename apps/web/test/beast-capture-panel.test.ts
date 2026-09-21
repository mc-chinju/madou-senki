import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { BeastCapturePanel } from '../src/game/BeastCapturePanel.js';
import { beastCaptureCommand, type BeastCaptureInputView } from '../src/game/beast-capture-input.js';
import { AbilityChoice } from '../src/game/AbilityPanel.js';
import type { AbilityInputView } from '../src/game/ability-input.js';
import { PublicLog } from '../src/game/PublicLog.js';
import { FollowerDestructionSummary } from '../src/game/FollowerDestructionSummary.js';
import { ReactionPanel } from '../src/game/ReactionPanel.js';
import type { PlayerView } from '@madou/engine';

function choice(): BeastCaptureInputView {
  return { self: { id: 'A' }, legalChoices: ['CHOOSE_BEAST_CAPTURE', 'PASS'],
    activeWindow: { windowId: 'saved-choice', windowRevision: 0, kind: 'beast-capture', pendingActorId: 'A', reason: 'beast-capture', participantIds: ['A'], passedActorIds: [], passAhead: false },
    beastCapture: { groupId: 'finished-group', windowId: 'saved-choice', actorId: 'A', candidates: [
      { cardInstanceId: 'a2-p20-r3c1', name: 'グリフォン', targetId: 'B', position: 0 },
      { cardInstanceId: 'a2-p22-r3c1', name: '飛竜', targetId: 'C', position: 1 },
    ] },
  };
}
test('capture commands bind one unique selected subset to the saved private decision', () => {
  const view = choice(); const ids = ['a2-p22-r3c1'];
  expect(beastCaptureCommand(view, ids)).toEqual({ type: 'CHOOSE_BEAST_CAPTURE', groupId: 'finished-group', windowId: 'saved-choice', cardInstanceIds: ids });
  expect(beastCaptureCommand(view, [])).toMatchObject({ cardInstanceIds: [] });
  expect(beastCaptureCommand(view, ['forged'])).toBeNull();
  expect(beastCaptureCommand(view, [...ids, ...ids])).toBeNull();
  expect(beastCaptureCommand({ ...view, self: { id: 'B' } }, ids)).toBeNull();
  expect(beastCaptureCommand({ ...view, beastCapture: null }, ids)).toBeNull();
  expect(beastCaptureCommand({ ...view, legalChoices: ['PASS'] }, ids)).toBeNull();
  expect(beastCaptureCommand({ ...view, activeWindow: { ...view.activeWindow!, windowId: 'next-choice' } }, ids)).toBeNull();
  expect(beastCaptureCommand({ ...view, activeWindow: { ...view.activeWindow!, pendingActorId: 'B' } }, ids)).toBeNull();
  expect(beastCaptureCommand({ ...view, activeWindow: { ...view.activeWindow!, kind: 'death-gift' } }, ids)).toBeNull();
});
test('earned owner choices start unchecked, identify original positions and retain an explicit decline', () => {
  const html = renderToStaticMarkup(createElement(BeastCapturePanel, { view: choice(), names: { A: '葵', B: '楓', C: '凛' }, disabled: false, send: () => true }));
  expect(html).toContain('獣の取得'); expect(html).toContain('role="status"');
  expect(html).toMatch(/楓さんの1番目[^]*グリフォン/); expect(html).toMatch(/凛さんの2番目[^]*飛竜/);
  expect(html.match(/type="checkbox"/g)).toHaveLength(2); expect(html).not.toContain('checked=""');
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>選んだ獣を手札に加える/);
  expect(html).toContain('奪わずに進む'); expect(html).not.toContain('finished-group'); expect(html).not.toContain('saved-choice');
});
test('other viewers see only a waiting prompt and completed windows render nothing', () => {
  const view = choice();
  const html = renderToStaticMarkup(createElement(BeastCapturePanel, { view: { ...view, self: { id: 'B' }, beastCapture: null, legalChoices: [] }, names: { A: '葵' }, disabled: false, send: () => true }));
  expect(html).toContain('葵さんの判断を待っています'); expect(html).not.toContain('グリフォン'); expect(html).not.toContain('飛竜');
  expect(html).not.toContain('type="checkbox"'); expect(html).not.toContain('<button');
  expect(renderToStaticMarkup(createElement(BeastCapturePanel, { view: { ...view, activeWindow: null, beastCapture: null }, names: {}, disabled: false, send: () => true }))).toBe('');
});
test('capture controls remain disabled while connection acceptance is pending', () => {
  const html = renderToStaticMarkup(createElement(BeastCapturePanel, { view: choice(), names: {}, disabled: true, send: () => true }));
  expect(html).toMatch(/<fieldset[^>]*disabled=""/);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>奪わずに進む/);
});
test('the initial ability explains independent optional capture after positive body damage', () => {
  const option = { abilityId: 'c2-p05-r1c2-ab03', name: '獣共感', targetEventId: 'attack-event' };
  const view: AbilityInputView = { self: { id: 'A', hand: [], chants: [] }, abilityOptions: [option], legalChoices: ['USE_ABILITY'], activeWindow: null,
    currentAction: null, additionalAttack: null, additionalAttackOptions: [], advanceCostOptions: [], players: { A: { presence: 'active' } } };
  const html = renderToStaticMarkup(createElement(AbilityChoice, { view, option, disabled: false, send: () => true }));
  for (const text of ['戦士技', '獣の従者を無視', '相手本人に1点以上', '選んで手札']) expect(html).toContain(text);
  expect(html).not.toContain('type="checkbox"'); expect(html).not.toContain('<select');
});
test('public capture movement names only participants and count', () => {
  const view = { logs: [{ id: 1, at: 0, type: 'BEAST_CAPTURED', actorId: 'A', targetId: 'B', count: 2 }], privateLogs: [], players: { A: { name: '葵' }, B: { name: '楓' } } } as unknown as PlayerView;
  const html = renderToStaticMarkup(createElement(PublicLog, { view, onInspect: () => {} }));
  expect(html).toContain('楓さんから獣を2枚手札に加えました'); expect(html).not.toContain('BEAST_CAPTURED');
  expect(html).not.toContain('グリフォン'); expect(html).not.toContain('飛竜');
});
test('public beast ignore is read per hit without revealing private capture candidates', () => {
  const attack: PlayerView['currentAttack'] = { groupId: 'group', actionId: 'action', attackerId: 'A', targetIds: ['B', 'C'], hitIndex: 0, targetId: 'B', reason: 'normal-defense',
    technique: { effectLevel: 5, damage: 7, attributes: ['剣'], destructionEffects: [], beastIgnore: true },
    defenseRestrictions: { maaiProhibited: false, evadeProhibited: false, counterProhibited: false }, targets: [
      { actorId: 'B', hits: [{ index: 0, defended: false, hit: false, sourceCardInstanceId: 'a2-p08-r1c1', technique: { effectLevel: 5, damage: 7, attributes: ['剣'], destructionEffects: [], beastIgnore: true } }] },
      { actorId: 'C', hits: [{ index: 1, defended: false, hit: false, technique: { effectLevel: 6, damage: 9, attributes: ['風'], destructionEffects: [], beastIgnore: false } }] },
    ] };
  const html = renderToStaticMarkup(createElement(FollowerDestructionSummary, { attack, results: [], names: { B: '楓', C: '凛' } }));
  expect(html).toMatch(/楓への1発目[^]*獣属性の従者を無視/);
  expect(html).not.toContain('凛への'); expect(html).not.toContain('グリフォン'); expect(html).not.toContain('飛竜');
});
test('the dedicated capture panel replaces generic reaction controls', () => {
  expect(renderToStaticMarkup(createElement(ReactionPanel, { view: choice() as unknown as PlayerView, disabled: false, send: () => true }))).toBe('');
});
