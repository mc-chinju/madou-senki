import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlayerView, PublicPlayerView } from '@madou/engine';
import { expect, test } from 'vitest';
import { StatusList } from '../src/game/StatusList.js';
import { LifetimeDecisionPanel } from '../src/game/LifetimeDecisionPanel.js';

test('fixed duration stop displays personal turns without offering ordinary recovery', () => {
  const player = { name: '葵', statuses: [{ kind: 'stopped', timing: 'fixed-turns', remainingTurns: 3, sourceCardInstanceId: 'a2-p13-r3c3' }] } as unknown as PublicPlayerView;
  const html = renderToStaticMarkup(createElement(StatusList, { player, own: true }));
  expect(html).toContain('あと自分の手番3回');
  expect(html).not.toContain('次の回復判定');
  expect(html).not.toContain('手番開始時に回復を判定');
});

test('deadly recovery and until-death stat loss explain their different lifetimes', () => {
  const player = { name: '葵', statuses: [{ kind: 'stopped', timing: 'deadly-recovery', recoveryModifier: -3, nextCheck: 0 },
    { kind: 'stat-drain', timing: 'until-death', amount: 2 }] } as unknown as PublicPlayerView;
  const html = renderToStaticMarkup(createElement(StatusList, { player, own: true }));
  expect(html).toContain('次の回復判定に失敗すると死亡');
  expect(html).toContain('戦士Lv・魔法Lv・精神力が各2低下');
  expect(html).toContain('死亡するまで');
  expect(html).not.toContain('NaN');
});

test('Soul drain presents instant death and stat reduction as distinct explicit choices', () => {
  const view = { self: { id: 'A' }, players: { B: { name: '楓' } }, legalChoices: ['CHOOSE_LIFETIME_EFFECT'],
    lifetimeDecision: { kind: 'soul-drain', actorId: 'A', targetId: 'B', sourceCardInstanceId: 'a2-p15-r2c3', choices: ['apply', 'decline'] },
  } as unknown as PlayerView;
  const html = renderToStaticMarkup(createElement(LifetimeDecisionPanel, { view, disabled: false, send: () => true }));
  expect(html).toContain('即死させる');
  expect(html).toContain('能力値を各1下げる');
  expect(html).not.toContain('CHOOSE_LIFETIME_EFFECT');
});
