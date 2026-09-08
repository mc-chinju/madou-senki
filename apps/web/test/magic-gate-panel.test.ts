import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { PlayerView } from '@madou/engine';
import { MagicGatePanel } from '../src/game/MagicGatePanel.js';
import { ActionSummary } from '../src/game/ActionSummary.js';

test('Magic Gate displays hidden donor positions without identifying them and never preselects a paid replacement', () => {
  const view = { self: { id: 'A', hand: ['a2-p17-r3c3'], followers: [{ cardInstanceId: 'a2-p21-r2c1' }, { cardInstanceId: 'a2-p18-r3c1' }], stats: { followerLimit: 2 } },
    seatOrder: ['A', 'B'], players: { A: { name: '葵', followers: [] }, B: { name: '楓', followers: [{ position: 0, face: 'back' }, { position: 1, face: 'front', cardInstanceId: 'a2-p19-r1c3' }] } },
    activeWindow: null, legalChoices: ['PLAY_TURN_TECHNIQUE'], followerPlacementOptions: { placeableCardInstanceIds: [], removableCardInstanceIds: ['a2-p18-r3c1'] },
    magicGateTargets: [{ actorId: 'B', positions: [0, 1] }] } as unknown as PlayerView;
  const html = renderToStaticMarkup(createElement(MagicGatePanel, { view, disabled: false, send: () => true }));
  expect(html).toContain('裏向き'); expect(html).toContain('砦');
  expect(html).toContain('取得できなくても、使用した札は戻りません');
  expect(html).toContain('受入れのために外す従者');
  const cost = html.match(/受入れのために外す従者<select[\s\S]*?<\/select>/)![0];
  expect(cost).toContain('ゴブリン'); expect(cost).not.toContain('闇の聖女');
  expect(cost).toContain('<option value="" selected="">');
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>魔招門を使う<\/button>/);
});
test('automatic follower reflection is named as such and retains the incoming technique values', () => {
  const action = { source: 'follower', kind: 'follower-reflection', actionId: 'reflected-1', actorId: 'B', cardInstanceId: 'a2-p21-r1c2', targetIds: ['A'], stage: 'resolve', technique: { range: 'far', attributes: ['魔'], useLevel: 4, effectLevel: 4, damage: 6 } } as unknown as PlayerView['currentAction'];
  const html = renderToStaticMarkup(createElement(ActionSummary, { action, names: { A: '葵', B: '楓' } }));
  expect(html).toContain('王立騎士団による反射'); expect(html).toContain('効果値 4'); expect(html).toContain('ダメージ 6');
});
