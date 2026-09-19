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
  // Two windows of the same kind in a row are one thing to the reader; the name is not repeated.
  expect(html(view([{ id: 1, type: 'PASSED', actorId: 'B', windowKind: 'lifecycle-boundary' }, { id: 2, type: 'PASSED', actorId: 'B', windowKind: 'lifecycle-boundary' }]))).toContain('<strong>楓</strong>が区切りでパスしました');
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
    { id: 61, type: 'ROLL_RESOLVED', actorId: 'A', roll: { rollId: 't', kind: 'training', faces: [5, 4], total: 9, threshold: 7, comparison: 'greater-than', success: true, attempt: 1 } },
    { id: 62, type: 'ROLL_RESOLVED', actorId: 'A', roll: { rollId: 'u', kind: 'use', faces: [1, 2], total: 3, threshold: 9, success: false, forcedFailure: true, attempt: 1 } },
    { id: 63, type: 'ROLL_RESOLVED', actorId: 'A', roll: { rollId: 'v', kind: 'attack-damage', faces: [4], total: 4, attempt: 1 } },
    { id: 7, type: 'DAMAGE_APPLIED', actorId: 'B', amount: 21 },
    { id: 8, type: 'STATUS_CHANGED', actorId: 'B', status: { kind: 'stopped', change: 'applied' } },
    { id: 9, type: 'STATUS_CHANGED', actorId: 'B', status: { kind: 'stopped', change: 'removed' } },
    { id: 10, type: 'DISTANCE_CHANGED', actorId: 'A', targetId: 'B', distance: 'near' },
    { id: 11, type: 'REST', actorId: 'A', count: 2 },
    { id: 12, type: 'TURN_ENDED', actorId: 'B', turnNumber: 1 },
    { id: 13, type: 'FUTURE_EVENT' as LogView['type'], actorId: 'D' },
  ]));
  expect(markup).toMatch(/<strong>楓<\/strong>が葵さんへ防御を宣言しました（<button class="card-link" aria-label="[^"]+の詳細を見る">[^<]+<\/button>）/);
  expect(markup).toMatch(/<strong>葵<\/strong>が楓さんへ<button class="card-link" aria-label="[^"]+（[^"]+）の詳細を見る">[^<]+<\/button>を宣言しました/);
  expect(markup).toContain('<strong>凛</strong>が特殊能力を宣言しました');
  // Which throw this is comes before the numbers, so the reader knows what to make of them.
  expect(markup).toContain('使用Lv超過の判定の振り直し1回目で3・4（合計7）を出しました（目標値8以下・成功）');
  // 修行 is the one check that wants a bigger total, so the line has to say which way the threshold is read.
  expect(markup).toContain('修行の判定で5・4（合計9）を出しました（目標値7より大きい・成功）');
  expect(markup).toContain('使用の判定で1・2（合計3）を出しました（目標値9以下・強制失敗）');
  expect(markup).toContain('<strong>凛</strong>が抵抗の判定で6・6（合計12）を出しました</li>');
  // One die is already its own total.
  expect(markup).toContain('<strong>葵</strong>が攻撃ダメージで4を出しました</li>');
  expect(markup).toContain('21ダメージを受けました');
  expect(markup).toContain('停止状態になりました'); expect(markup).toContain('停止状態から回復しました');
  expect(markup).toContain('<strong>葵</strong>が楓さんと近距離になりました');
  expect(markup).toContain('休息しました（2枚）');
  expect(markup).toContain('<strong>楓</strong>が手番を終えました');
  expect(markup).toContain('<strong>蓮</strong>が記録');
  expect(markup).not.toContain('FUTURE_EVENT');
});

/** Every name the record prints must be a link, so a reader can open what it refers to. */
test('every record type names its target and keeps card, person and ability names inside links', () => {
  const logs: Omit<LogView, 'at'>[] = [
    { id: 1, type: 'TURN_STARTED', actorId: 'A', turnNumber: 1 },
    { id: 2, type: 'CARD_PLAYED', actorId: 'A', cardInstanceId: 'a2-p05-r3c1', use: 'attack', targetIds: ['B', 'C'] },
    { id: 3, type: 'CARD_PLAYED', actorId: 'B', cardInstanceId: 'a2-p05-r3c1', use: 'maai', targetIds: ['A'] },
    { id: 4, type: 'CARD_PLAYED', actorId: 'B', cardInstanceId: 'a2-p05-r3c1', use: 'advance' },
    { id: 5, type: 'CARD_PLAYED', actorId: 'C', cardInstanceId: 'a2-p02-r1c2', use: 'anytime', targetIds: ['A'] },
    // A follower attack and 全軍突撃 name the follower they sent; a virtual follower names its ability.
    { id: 6, type: 'CARD_PLAYED', actorId: 'A', cardInstanceId: 'a2-p20-r3c1', use: 'attack', targetIds: ['B'] },
    { id: 7, type: 'CARD_PLAYED', actorId: 'A', cardInstanceId: 'a2-p05-r2c2', use: 'attack', targetIds: ['B'] },
    { id: 8, type: 'ATTACK_DECLARED', actorId: 'D', abilityId: 'c2-p04-r1c1-ab02', targetIds: ['B'] },
    { id: 9, type: 'ATTACK_DECLARED', actorId: 'D', targetIds: ['B'] },
    { id: 10, type: 'CHECK_SKIPPED', actorId: 'A', checkSkip: 'level' },
    { id: 11, type: 'CHECK_SKIPPED', actorId: 'A', checkSkip: 'card' },
    { id: 12, type: 'CHECK_SKIPPED', actorId: 'D', checkSkip: 'ability', abilityId: 'c2-p06-r2c2-ab02' },
    { id: 13, type: 'CHECK_SKIPPED', actorId: 'D', checkSkip: 'ability' },
    { id: 14, type: 'FOLLOWER_DESTROYED', actorId: 'B', targetId: 'A', cardInstanceId: 'a2-p20-r3c1' },
    { id: 15, type: 'CHARACTER_REVEALED', actorId: 'D', characterId: 'c2-p04-r1c1' },
    { id: 16, type: 'CHARACTER_TRANSFORMED', actorId: 'D', characterId: 'c2-p01-r1c1' },
    { id: 17, type: 'PLAYER_REVIVED', actorId: 'C', characterId: 'c2-p06-r2c2' },
    { id: 18, type: 'PLAYER_DIED', actorId: 'C', death: { cause: 'attack', eventId: 'e', sourceCardInstanceId: 'a2-p05-r3c1' } },
    { id: 19, type: 'CARD_GIFTED', actorId: 'C', targetId: 'B', cardInstanceId: 'a2-p02-r1c2' },
    { id: 20, type: 'OPEN', actorId: 'B', cardInstanceId: 'a2-p01-r1c1' },
    { id: 21, type: 'CHARACTER_INSPECTED', actorId: 'B', targetId: 'D', characterId: 'c2-p04-r2c2' },
    { id: 22, type: 'ABILITY_DECLARED', actorId: 'D', abilityId: 'c2-p04-r2c2-ab03', targetIds: ['A'] },
    { id: 23, type: 'ATTACK_RESOLVED', actorId: 'A', attackOutcome: 'hit', targetIds: ['B'], cardInstanceId: 'a2-p05-r3c1' },
    { id: 24, type: 'ATTACK_RESOLVED', actorId: 'A', attackOutcome: 'blocked', targetIds: ['B', 'C'] },
    { id: 25, type: 'ATTACK_RESOLVED', actorId: 'A', attackOutcome: 'fizzled', targetIds: ['B'] },
    { id: 26, type: 'ATTACK_RESOLVED', actorId: 'A', attackOutcome: 'nullified', targetIds: ['B'], abilityId: 'c2-p04-r1c1-ab02' },
  ];
  const markup = html(view(logs));
  expect(markup).toContain('が楓さん・凛さんへ攻撃を宣言しました（<button');
  expect(markup).toContain('が葵さんへ間合いを宣言しました（<button');
  expect(markup).toMatch(/<strong>楓<\/strong>が<button[^>]*>見切る<\/button>を踏み込みに使いました<\/li>/);
  // Every line that points at a seat opens the same way, whichever kind of line it is.
  expect(markup).toMatch(/<strong>凛<\/strong>が葵さんへ<button[^>]*>啓示<\/button>をいつでもに使いました/);
  expect(markup).toContain('が楓さんへ攻撃を宣言しました（<button class="card-link" aria-label="グリフォンの詳細を見る">グリフォン</button>）');
  expect(markup).toContain('が楓さんへ攻撃を宣言しました（<button class="card-link" aria-label="氷刃（凍気のアイエル）の詳細を見る">氷刃</button>）');
  expect(markup).toContain('が楓さんへ攻撃を宣言しました（特殊能力）');
  expect(markup).toContain('使用Lvを満たしていて判定は要りませんでした');
  expect(markup).toContain('カードの記述により判定は要りませんでした');
  expect(markup).toContain('>野獣</button>で判定を免れました');
  expect(markup).toContain('が特殊能力で判定を免れました');
  // A declared attack closes with how it ended, right where it ended.
  // Several attacks can be in flight at once, so the ending names the declaration it closes.
  expect(markup).toContain('<strong>葵</strong>の楓さんへの攻撃（<button class="card-link" aria-label="見切るの詳細を見る">見切る</button>）が命中しました');
  expect(markup).toContain('<strong>葵</strong>の楓さん・凛さんへの攻撃は防がれました');
  expect(markup).toContain('<strong>葵</strong>の楓さんへの攻撃は不発に終わりました');
  expect(markup).toContain('<strong>葵</strong>の楓さんへの攻撃（<button class="card-link" aria-label="氷刃（凍気のアイエル）の詳細を見る">氷刃</button>）は無効化されました');
  expect(markup).toContain('が葵さんの<button class="card-link" aria-label="グリフォンの詳細を見る">グリフォン</button>を破壊しました');
  // Nothing outside a link may print a card, person or ability name.
  const plain = markup.replace(/<button[^>]*>[^<]*<\/button>/g, '').replace(/aria-label="[^"]*"/g, '');
  for (const name of ['見切る', 'グリフォン', '全軍突撃せよ', '啓示', 'そうかっ', '氷刃', '野獣', '必殺', '凍気のアイエル', '白魔術師シェリム', '餓狼ヨーツルム', '忍びのイダ']) {
    expect(plain, `${name} escaped its link`).not.toContain(name);
  }
});

test('the reader can flip the record to newest first', () => {
  const v = view([
    { id: 1, type: 'SETUP_COMPLETE', actorId: 'A' },
    { id: 2, type: 'TURN_STARTED', actorId: 'A', turnNumber: 1 },
    { id: 3, type: 'PASSED', actorId: 'B', windowKind: 'declaration' },
    { id: 4, type: 'PASSED', actorId: 'C', windowKind: 'declaration' },
    { id: 5, type: 'DAMAGE_APPLIED', actorId: 'B', amount: 4 },
    { id: 6, type: 'TURN_STARTED', actorId: 'B', turnNumber: 2 },
    { id: 7, type: 'REST', actorId: 'B', count: 1 },
  ]);
  const oldest = publicLogSections(v), newest = publicLogSections(v, 'newest');
  expect(oldest.map(section => section.heading)).toEqual(['対戦準備', '1手番 葵さん', '2手番 楓さん']);
  expect(newest.map(section => section.heading)).toEqual(['2手番 楓さん', '1手番 葵さん', '対戦準備']);
  // The fold still runs over the chronological run, so the two passes stay one line in either order.
  expect(newest[1]!.lines).toEqual([
    { kind: 'event', event: expect.objectContaining({ id: 5 }) },
    { kind: 'passes', id: 3, lastId: 4, windowKinds: ['declaration'], actorIds: ['B', 'C'] },
  ]);
  expect(oldest[1]!.lines.map(line => (line.kind === 'event' ? line.event.id : line.id))).toEqual([3, 5]);
});

test('leaving a whole action to the others reads as one line per action', () => {
  const v = view([
    { id: 1, type: 'TURN_STARTED', actorId: 'A', turnNumber: 1 },
    { id: 2, type: 'PASSED', actorId: 'C', windowKind: 'action-through' },
    { id: 3, type: 'PASSED', actorId: 'D', windowKind: 'action-through' },
    { id: 4, type: 'PASSED', actorId: 'B', windowKind: 'declaration' },
  ]);
  expect(publicLogSections(v)[0]!.lines).toEqual([
    { kind: 'through', id: 2, lastId: 3, actorIds: ['C', 'D'] },
    { kind: 'passes', id: 4, lastId: 4, windowKinds: ['declaration'], actorIds: ['B'] },
  ]);
  expect(html(v)).toContain('<strong>凛・蓮</strong>がこの行動を任せました');
});
