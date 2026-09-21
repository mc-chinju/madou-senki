import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, logPage, LOG_PAGE_MAX, viewFor, type GameState, type LogView, type PlayerView } from '@madou/engine';
import { playOneStep } from '@madou/engine/bot';
import { expect, test } from 'vitest';
import { newestRecordId, PublicLog, publicLogSections, readTo, unreadLines, type LogSection } from '../src/game/PublicLog.js';
import { logInvolves, parseFilter, readerCards, serializeFilter, type LogFilter } from '../src/game/log-filter.js';
import { seededEntropy } from '../../../packages/engine/test/fixtures.js';

const players = { A: { name: '葵' }, B: { name: '楓' }, C: { name: '凛' }, D: { name: '蓮' } };
const view = (logs: Omit<LogView, 'at'>[], privateLogs: Omit<LogView, 'at'>[] = [], self: Partial<PlayerView['self']> = {}) =>
  ({
    players, seatOrder: ['A', 'B', 'C', 'D'],
    self: { id: 'A', hand: [], followers: [], chants: [], discardedCardInstanceIds: [], ...self },
    logs: logs.map(log => ({ at: 0, ...log })), privateLogs: privateLogs.map(log => ({ at: 0, ...log })),
  }) as unknown as PlayerView;
const html = (v: PlayerView) => renderToStaticMarkup(createElement(PublicLog, { view: v, onInspect: () => {} }));

/** The rule lives in one place, so what belongs to a seat is settled here and nowhere else. */
test('a record belongs to a seat when it acted, when it is pointed at, or when a card of its own moved', () => {
  const own = new Set(['a2-p01-r1c1']);
  const at = (event: Omit<LogView, 'at' | 'id'>) => logInvolves({ id: 1, at: 0, ...event } as LogView, 'A', own);
  expect(at({ type: 'REST', actorId: 'A' })).toBe(true);
  expect(at({ type: 'REST', actorId: 'B' })).toBe(false);
  expect(at({ type: 'FOLLOWER_DESTROYED', actorId: 'B', targetId: 'A' })).toBe(true);
  expect(at({ type: 'CARD_PLAYED', actorId: 'B', targetIds: ['C', 'A'], use: 'attack' })).toBe(true);
  expect(at({ type: 'CARD_PLAYED', actorId: 'B', targetIds: ['C'], use: 'attack' })).toBe(false);
  // A card of this reader's can move in someone else's hands; the record still concerns them.
  expect(at({ type: 'WISH_ACQUIRED', actorId: 'B', cardInstanceId: 'a2-p01-r1c1' })).toBe(true);
  expect(at({ type: 'FOLLOWERS_ARRANGED', actorId: 'B', cardInstanceIds: ['a2-p02-r1c2', 'a2-p01-r1c1'] })).toBe(true);
  expect(at({ type: 'WISH_ACQUIRED', actorId: 'B', cardInstanceId: 'a2-p02-r1c2' })).toBe(false);
  // Who dealt the death and with what is the killer's record as much as the dead seat's.
  expect(at({ type: 'PLAYER_DIED', actorId: 'B', death: { cause: 'attack', eventId: 'e', sourceActorId: 'A' } })).toBe(true);
  expect(at({ type: 'PLAYER_DIED', actorId: 'B', death: { cause: 'attack', eventId: 'e', sourceCardInstanceId: 'a2-p01-r1c1' } })).toBe(true);
  expect(at({ type: 'PLAYER_DIED', actorId: 'B', death: { cause: 'attack', eventId: 'e', sourceActorId: 'C' } })).toBe(false);
  // A seat other than the reader is read by name alone: nobody else's holdings are known here.
  expect(logInvolves({ id: 1, at: 0, type: 'WISH_ACQUIRED', actorId: 'A', cardInstanceId: 'a2-p01-r1c1' } as LogView, 'B')).toBe(false);
  // The reader's own record names cards nobody else ever saw, so those count as their own too.
  expect(readerCards(view([], [{ id: 1, type: 'CHANTED', actorId: 'A', cardInstanceId: 'a2-p05-r2c2' }], { hand: ['a2-p01-r1c1'] })))
    .toEqual(new Set(['a2-p01-r1c1', 'a2-p05-r2c2']));
});

test('a filter drops the turns and passes the chosen seat has no share in, and keeps the fold intact', () => {
  const v = view([
    { id: 1, type: 'TURN_STARTED', actorId: 'B', turnNumber: 1 },
    { id: 2, type: 'CARD_PLAYED', actorId: 'B', cardInstanceId: 'a2-p05-r3c1', use: 'attack', targetIds: ['A'] },
    { id: 3, type: 'PASSED', actorId: 'C', windowKind: 'declaration' },
    { id: 4, type: 'PASSED', actorId: 'D', windowKind: 'declaration' },
    { id: 5, type: 'PASSED', actorId: 'A', windowKind: 'declaration' },
    { id: 6, type: 'ROLL_RESOLVED', actorId: 'B', roll: { rollId: 'r', kind: 'use', faces: [3], total: 3, attempt: 1 } },
    { id: 7, type: 'ATTACK_RESOLVED', actorId: 'B', attackOutcome: 'hit', targetIds: ['A'], cardInstanceId: 'a2-p05-r3c1' },
    { id: 8, type: 'DAMAGE_APPLIED', actorId: 'A', amount: 4 },
    { id: 10, type: 'TURN_STARTED', actorId: 'C', turnNumber: 2 },
    { id: 11, type: 'CARD_RECLAIMED', actorId: 'A' },
    { id: 13, type: 'REST', actorId: 'C', count: 1 },
    { id: 14, type: 'TURN_STARTED', actorId: 'D', turnNumber: 3 },
    { id: 15, type: 'REST', actorId: 'D', count: 2 },
  ], [
    { id: 12, type: 'CARD_RECLAIMED', actorId: 'A', cardInstanceId: 'a2-p02-r1c2' },
  ]);
  const ids = (sections: LogSection[]) => sections.flatMap(s => s.lines.map(line => (line.kind === 'event' ? line.event.id : line.id)));
  expect(ids(publicLogSections(v))).toEqual([2, 3, 6, 7, 8, 11, 13, 15]);
  // The reader's turn-3 heading hangs over nothing once the filter runs, so it goes with its lines.
  const self = publicLogSections(v, 'oldest', { kind: 'self' });
  expect(self.map(section => section.heading)).toEqual(['1手番 楓さん', '2手番 凛さん']);
  expect(ids(self)).toEqual([2, 5, 7, 8, 11]);
  // PR 2's fold survives: the table's line and the reader's own name of the same act are still one line.
  const reclaim = self[1]!.lines[0]!;
  expect(reclaim).toMatchObject({ kind: 'event', own: false, ownCardInstanceIds: ['a2-p02-r1c2'] });
  // Reading one seat keeps what that seat did and what was aimed at it.
  expect(ids(publicLogSections(v, 'oldest', { kind: 'seat', actorId: 'C' }))).toEqual([3, 13]);
  // Newest first still folds over the chronological run, so a filter cannot change what folds.
  expect(ids(publicLogSections(v, 'newest', { kind: 'self' }))).toEqual([11, 8, 7, 5, 2]);
});

/** Reading one's own seat from the participant list has to mean the same as 「自分に関係する」. Only the reader
 *  knows which cards are their own, so a record that points at them by card and not by name is exactly the one
 *  that falls out when the two ways of naming the same seat are decided in different places. */
test('naming the reader own seat reads the same record as asking for what concerns them', () => {
  const v = view([
    { id: 1, type: 'TURN_STARTED', actorId: 'B', turnNumber: 1 },
    { id: 3, type: 'WISH_ACQUIRED', actorId: 'B', cardInstanceId: 'a2-p02-r1c2' },
  ], [
    { id: 2, type: 'CHANTED', actorId: 'A', cardInstanceId: 'a2-p02-r1c2' },
  ]);
  const ids = (filter: LogFilter) => publicLogSections(v, 'oldest', filter).flatMap(s => s.lines.map(line => (line.kind === 'event' ? line.event.id : line.id)));
  // Someone else moved a card the reader only ever saw named in their own record.
  expect(ids({ kind: 'self' })).toContain(3);
  expect(ids({ kind: 'seat', actorId: 'A' })).toEqual(ids({ kind: 'self' }));
});

test('the filter is offered, remembered for this table, and says so when it keeps nothing', () => {
  expect(parseFilter('seat:C', ['A', 'B', 'C', 'D'])).toEqual({ kind: 'seat', actorId: 'C' });
  // A seat that is not at this table is no filter at all.
  expect(parseFilter('seat:Z', ['A', 'B'])).toEqual({ kind: 'all' });
  expect(parseFilter(null, ['A'])).toEqual({ kind: 'all' });
  expect(serializeFilter({ kind: 'seat', actorId: 'C' })).toBe('seat:C');
  const markup = html(view([{ id: 1, type: 'REST', actorId: 'B', count: 1 }]));
  expect(markup).toContain('<option value="self">自分に関係する</option>');
  expect(markup).toContain('<option value="seat:C">凛さん</option>');
  expect(renderToStaticMarkup(createElement(PublicLog, { view: view([]), onInspect: () => {} }))).toContain('記録はまだありません');
});

/** The record arrives in pages now, so its far end has to say where the reader stands in it. */
test('the record says whether more of it can be read, and offers the page before what it holds', () => {
  const paged = { ...view([{ id: 51, type: 'REST', actorId: 'A', count: 1 }]), logStart: 1 } as PlayerView;
  const asked: number[] = [];
  const render = (v: PlayerView, loading: boolean) =>
    renderToStaticMarkup(createElement(PublicLog, { view: v, onInspect: () => {}, logHistory: { loading, load: (id: number) => { asked.push(id); } } }));
  expect(render(paged, false)).toContain('過去の記録を読む');
  expect(render(paged, true)).toContain('過去の記録を読み込んでいます');
  // A record whose oldest line is its first has nothing left behind it.
  expect(render({ ...paged, logStart: 51 } as PlayerView, false)).toContain('これが戦記の最初です');
  // A reader with no way to ask is told nothing about an end they cannot reach.
  expect(html(paged)).not.toContain('過去の記録');
  // A window that opens mid-record holds the tail of a turn it has not read the start of, so calling that
  // run 「対戦準備」 would file the end of the game under the setup.
  expect(publicLogSections(paged)[0]!.heading).toBe('手番の途中から');
  expect(publicLogSections({ ...paged, logStart: 51 } as PlayerView)[0]!.heading).toBe('対戦準備');
});

/** The reader as the panel keeps them: one mark for how far they have read, moved only by standing at the
 *  followed end of the record. Everything else the panel does to the record — filtering it, laying an older
 *  page in front of it, taking in a newer window — leaves the mark alone, so the rules are readable here. */
function reader(start: PlayerView) {
  let view = start, seenId = newestRecordId(view);
  return {
    // A newer window, or an older page joined to what is held: either way it is the record the reader now has.
    holds(next: PlayerView) { view = next; },
    // The reader is shown the end of the record: at the followed end, or by asking for the newest line.
    follow() { seenId = readTo(seenId, view); },
    unread(filter: LogFilter) { return unreadLines(publicLogSections(view, 'oldest', filter), seenId); },
    seen() { return seenId; },
  };
}

/** 「新着」 counts what arrived while the reader was away, and nothing else. A filter widened back out and a
 *  page read back from the past both put lines on screen that were never new to this reader. */
test('widening the filter and reading the past back announce nothing; a line that arrives is announced', () => {
  const held = [
    { id: 11, type: 'TURN_STARTED' as const, actorId: 'B', turnNumber: 2 },
    { id: 12, type: 'CARD_PLAYED' as const, actorId: 'B', cardInstanceId: 'a2-p05-r3c1', use: 'attack' as const, targetIds: ['A'] },
    { id: 13, type: 'REST' as const, actorId: 'B', count: 1 },
    { id: 14, type: 'REST' as const, actorId: 'C', count: 1 },
  ];
  // The end of the record is two lines the reader has no share in, so 「自分に関係する」 hides exactly the end.
  const filtered = publicLogSections(view(held), 'oldest', { kind: 'self' }).flatMap(section => section.lines);
  expect(Math.max(...filtered.map(line => (line.kind === 'event' ? line.event.id : line.lastId)))).toBe(12);
  const r = reader(view(held));
  expect(r.seen()).toBe(14);
  r.follow();
  // Widening the filter brings back lines that were there all along.
  expect(r.unread({ kind: 'all' })).toBe(0);
  expect(r.unread({ kind: 'seat', actorId: 'C' })).toBe(0);
  // An older page is laid in front of the reader, not on the end they are following.
  r.holds(view([{ id: 1, type: 'TURN_STARTED', actorId: 'A', turnNumber: 1 }, { id: 2, type: 'REST', actorId: 'A', count: 2 }, ...held]));
  expect(r.unread({ kind: 'all' })).toBe(0);
  expect(r.unread({ kind: 'self' })).toBe(0);
  // What did arrive is announced, and only where the filter keeps it.
  r.holds(view([...held, { id: 15, type: 'REST', actorId: 'C', count: 1 }, { id: 16, type: 'CARD_PLAYED', actorId: 'C', cardInstanceId: 'a2-p05-r3c1', use: 'attack', targetIds: ['A'] }]));
  expect(r.unread({ kind: 'all' })).toBe(2);
  expect(r.unread({ kind: 'self' })).toBe(1);
  // Standing at the end again reads them, and the reader's own record moves the mark as much as the table's.
  r.follow();
  expect(r.unread({ kind: 'all' })).toBe(0);
  r.holds(view([...held, { id: 15, type: 'REST', actorId: 'C', count: 1 }, { id: 16, type: 'CARD_PLAYED', actorId: 'C', cardInstanceId: 'a2-p05-r3c1', use: 'attack', targetIds: ['A'] }],
    [{ id: 17, type: 'CARD_DRAWN', actorId: 'A', cardInstanceId: 'a2-p01-r1c1' }]));
  expect(r.unread({ kind: 'all' })).toBe(1);
  r.follow();
  expect(r.seen()).toBe(17);
  expect(r.unread({ kind: 'all' })).toBe(0);
  // The mark is the whole record's newest line, never the newest line the filter happens to keep.
  expect(newestRecordId(view([{ id: 3, type: 'REST', actorId: 'B', count: 1 }], [{ id: 5, type: 'CARD_DRAWN', actorId: 'A' }]))).toBe(5);
  expect(newestRecordId(view([]))).toBe(0);
});

/** Acceptance (plan Task 4): a bot 4-seat game, counting the lines drawn from an attack's declaration to its ending. */
function attackSpans(sections: LogSection[], seatId?: string): number[] {
  const lines = sections.flatMap(section => section.lines);
  const open = new Map<string, number>(), spans: number[] = [];
  lines.forEach((line, index) => {
    if (line.kind !== 'event') return;
    const { type, actorId, use, targetIds } = line.event;
    if (type === 'ATTACK_DECLARED' || (type === 'CARD_PLAYED' && use === 'attack')) { if (!open.has(actorId)) open.set(actorId, index); return; }
    if (type !== 'ATTACK_RESOLVED') return;
    const start = open.get(actorId);
    if (start === undefined) return;
    open.delete(actorId);
    // Only the attacks this seat has a share in are what the filtered record promises to shorten.
    if (!seatId || actorId === seatId || targetIds?.includes(seatId)) spans.push(index - start + 1);
  });
  return spans;
}
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
/** A snapshot carries only the newest window, so the measure reads the record back to its start first.
 *  Measuring the window alone would weigh a handful of late attacks and skip the seats with none in it. */
function wholeRecord(state: GameState, seatId: string): PlayerView {
  const newest = viewFor(state, seatId);
  const logs: LogView[] = [...newest.logs], privateLogs: LogView[] = [...newest.privateLogs];
  while (logs.length && logs[0]!.id > newest.logStart) {
    const page = logPage(state, seatId, { beforeId: logs[0]!.id, limit: LOG_PAGE_MAX });
    if (!page.logs.length) break;
    logs.unshift(...page.logs); privateLogs.unshift(...page.privateLogs);
  }
  return { ...newest, logs, privateLogs };
}

test('reading only what concerns the reader keeps an attack under seven lines in a bot four-seat game', () => {
  const seed = 15, entropy = seededEntropy(seed);
  let state: GameState = createGame(Array.from({ length: 4 }, (_, i) => ({ id: `P${i}`, name: `P${i}` })), entropy);
  for (let steps = 0; !state.outcome && steps < 5000; steps++) state = playOneStep(state, entropy, seed);
  expect(state.outcome).toBeTruthy();
  for (const seatId of state.seatOrder) {
    const v = wholeRecord(state, seatId);
    expect(v.logs.length, `${seatId} reads the whole record, not one window`).toBe(state.events.filter(event => event.audience === 'public').length);
    const whole = attackSpans(publicLogSections(v), seatId);
    // A seat with no attack to weigh would pass this on an empty span list, so the measure has to have one.
    expect(whole.length, `${seatId} shares at least one attack`).toBeGreaterThan(0);
    const filtered = attackSpans(publicLogSections(v, 'oldest', { kind: 'self' }), seatId);
    // Shortening the record must not lose an attack: every one the seat shares still opens and closes.
    expect(filtered.length, `${seatId} keeps every attack it shares`).toBe(whole.length);
    // Measured 2026-09-20 on seed 15: 10.7-12.0 lines an attack whole (max 14), 4.9-5.3 filtered (max 7).
    expect(Math.max(...filtered), `${seatId}: ${mean(whole).toFixed(1)} lines an attack whole, ${mean(filtered).toFixed(1)} filtered`).toBeLessThanOrEqual(7);
  }
});
