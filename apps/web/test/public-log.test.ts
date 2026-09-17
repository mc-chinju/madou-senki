import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LogView, PlayerView } from '@madou/engine';
import { expect, test } from 'vitest';
import { PublicLog, publicLogSections } from '../src/game/PublicLog.js';

const players = { A: { name: '葵' }, B: { name: '楓' }, C: { name: '凛' }, D: { name: '蓮' } };
const view = (logs: Omit<LogView, 'at'>[]) => ({ players, logs: logs.map(log => ({ at: 0, ...log })) }) as unknown as PlayerView;
const html = (v: PlayerView) => renderToStaticMarkup(createElement(PublicLog, { view: v, onInspect: () => {} }));

test('turns become headings and consecutive passes in one window fold into one line', () => {
  const v = view([
    { id: 1, type: 'SETUP_COMPLETE', actorId: 'A' },
    { id: 2, type: 'TURN_STARTED', actorId: 'A', turnNumber: 3 },
    { id: 3, type: 'CARD_PLAYED', actorId: 'A', cardInstanceId: 'a2-p01-r1c1', use: 'attack', targetIds: ['B'] },
    { id: 4, type: 'PASSED', actorId: 'B', windowKind: 'declaration' },
    { id: 5, type: 'PASSED', actorId: 'C', windowKind: 'declaration' },
    { id: 6, type: 'PASSED', actorId: 'D', windowKind: 'declaration' },
    { id: 7, type: 'PASSED', actorId: 'B', windowKind: 'declaration' },
    { id: 8, type: 'PASSED', actorId: 'C', windowKind: 'after-roll' },
  ]);
  const sections = publicLogSections(v);
  expect(sections.map(section => section.heading)).toEqual(['対戦準備', '3手番 葵さん']);
  expect(sections[1]!.lines.filter(line => line.kind === 'passes').map(line => line.kind === 'passes' && line.actorIds)).toEqual([['B', 'C', 'D'], ['B'], ['C']]);
  const merged = publicLogSections(view([
    { id: 1, type: 'TURN_STARTED', actorId: 'A', turnNumber: 1 },
    ...['declaration', 'before-roll'].flatMap((windowKind, w) => ['B', 'C'].map((actorId, i) => ({ id: 2 + w * 2 + i, type: 'PASSED' as const, actorId, windowKind }))),
  ]))[0]!.lines;
  expect(merged).toEqual([{ kind: 'passes', id: 2, lastId: 5, windowKinds: ['declaration', 'before-roll'], actorIds: ['B', 'C'] }]);
  expect(html(view([{ id: 1, type: 'PASSED', actorId: 'B', windowKind: 'declaration' }, { id: 2, type: 'PASSED', actorId: 'B', windowKind: 'after-roll' }]))).toContain('<strong>楓</strong>が宣言、判定後でパスしました');
  const markup = html(v);
  expect(markup).toContain('<h3>3手番 葵さん</h3>');
  expect(markup).toContain('<strong>楓・凛・蓮</strong>が宣言でパスしました');
  expect(markup).toContain('<strong>凛</strong>が判定後でパスしました');
});

test('new record types read as sentences with card and ability links, and unknown types stay generic', () => {
  const markup = html(view([
    { id: 1, type: 'TURN_STARTED', actorId: 'B', turnNumber: 1 },
    { id: 2, type: 'CARD_PLAYED', actorId: 'B', cardInstanceId: 'a2-p01-r1c1', use: 'defense', targetIds: ['A'] },
    { id: 3, type: 'ABILITY_DECLARED', actorId: 'A', abilityId: 'c2-p04-r2c2-ab01', targetIds: ['B'] },
    { id: 4, type: 'ABILITY_DECLARED', actorId: 'C' },
    { id: 5, type: 'ROLL_RESOLVED', actorId: 'B', roll: { rollId: 'r', kind: 'excess-level', faces: [3, 4], total: 7, threshold: 8, success: true, attempt: 2 } },
    { id: 6, type: 'ROLL_RESOLVED', actorId: 'C', roll: { rollId: 's', kind: 'status-resistance', faces: [6, 6], total: 12, attempt: 1 } },
    { id: 7, type: 'DAMAGE_APPLIED', actorId: 'B', amount: 21 },
    { id: 8, type: 'STATUS_CHANGED', actorId: 'B', status: { kind: 'stopped', change: 'applied' } },
    { id: 9, type: 'STATUS_CHANGED', actorId: 'B', status: { kind: 'stopped', change: 'removed' } },
    { id: 10, type: 'DISTANCE_CHANGED', actorId: 'A', targetId: 'B', distance: 'near' },
    { id: 11, type: 'REST', actorId: 'A', count: 2 },
    { id: 12, type: 'TURN_ENDED', actorId: 'B', turnNumber: 1 },
    { id: 13, type: 'FUTURE_EVENT' as LogView['type'], actorId: 'D' },
  ]));
  expect(markup).toMatch(/<strong>楓<\/strong>が<button class="card-link" aria-label="[^"]+の詳細を見る">[^<]+<\/button>を防御に使いました（対象: 葵）/);
  expect(markup).toMatch(/<strong>葵<\/strong>が<button class="card-link" aria-label="[^"]+（[^"]+）の詳細を見る">[^<]+<\/button>を宣言しました（対象: 楓）/);
  expect(markup).toContain('<strong>凛</strong>が特殊能力を宣言しました');
  expect(markup).toContain('使用Lv超過の判定で3・4（合計7）を出しました（目標値8・成功）［振り直し1回目］');
  expect(markup).toContain('<strong>凛</strong>が抵抗の判定で6・6（合計12）を出しました</li>');
  expect(markup).toContain('21ダメージを受けました');
  expect(markup).toContain('停止状態になりました'); expect(markup).toContain('停止状態から回復しました');
  expect(markup).toContain('<strong>葵</strong>が楓さんと近距離になりました');
  expect(markup).toContain('休息しました（2枚）');
  expect(markup).toContain('<strong>楓</strong>が手番を終えました');
  expect(markup).toContain('<strong>蓮</strong>が記録');
  expect(markup).not.toContain('FUTURE_EVENT');
});
