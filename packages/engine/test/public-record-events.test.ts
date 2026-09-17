import {expect, it} from 'vitest';
import {gameStats, viewFor, type GameEvent, type GameState, type LogView} from '../src/index.js';
import {act, closeWindow, finish, pass, passReclaims, ready, until} from './combat-helpers.js';
import {character, handCard, handCards} from './fixtures.js';
import {makeR6RollScenario} from '../../../apps/worker/test/fixtures/r6-roll-scenarios.js';

const RECORD_TYPES = new Set(['TURN_STARTED', 'TURN_ENDED', 'REST', 'CARD_PLAYED', 'ABILITY_DECLARED', 'ABILITY_CANCELED', 'ROLL_RESOLVED', 'DAMAGE_APPLIED', 'STATUS_CHANGED', 'DISTANCE_CHANGED', 'PASSED']);
const record = (s: GameState, viewer = 'C') => viewFor(s, viewer).logs.filter(log => RECORD_TYPES.has(log.type));
const indexOf = (logs: LogView[], match: Partial<LogView>, from = 0) => logs.findIndex((log, index) => index >= from && Object.entries(match).every(([key, value]) => JSON.stringify(log[key as keyof LogView]) === JSON.stringify(value)));

/** Plays out other seats' turns with no action until `actorId` may start. */
function turnOf(s: GameState, actorId: string): GameState {
  for (let n = 0; n < 200; n++) {
    const id = s.seatOrder[s.turnSeat]!;
    if (s.windows?.length) s = pass(s);
    else if (s.phase === 'turn-start') { if (id === actorId) return s; s = act(s, id, {type: 'START_TURN'}); }
    else if (s.phase === 'draw') s = act(s, id, {type: 'CHOOSE_DRAW', draw: false});
    else if (s.phase === 'action') s = act(s, id, {type: 'PASS_ACTION'});
    else if (s.phase === 'withdrawal') s = act(s, id, {type: 'PASS_WITHDRAWAL'});
    else if (s.phase === 'hand-adjustment') s = act(s, id, {type: 'END_TURN', discardIds: s.players[id]!.hand.slice(0, Math.max(0, s.players[id]!.hand.length - gameStats(s, id).handLimit))});
    else throw Error(`TURN_PHASE ${s.phase}`);
  }
  throw Error('TURN_LIMIT');
}

it('one defended attack reads turn start, attack card, passes, defense card, then turn end', () => {
  let s = ready();
  const attack = handCard(s, 'A', '踏み込み／弓'), defense = handCard(s, 'B', '見切る');
  s = act(s, 'A', {type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false});
  s = until(s, 'normal-defense');
  s = finish(act(s, 'B', {type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: false}));
  expect(s.players.B!.damage).toBe(0);
  s = act(s, 'A', {type: 'PASS_WITHDRAWAL'});
  s = act(s, 'A', {type: 'END_TURN', discardIds: s.players.A!.hand.slice(0, Math.max(0, s.players.A!.hand.length - gameStats(s, 'A').handLimit))});
  const logs = record(s);
  const started = indexOf(logs, {type: 'TURN_STARTED', actorId: 'A', turnNumber: 1});
  const played = indexOf(logs, {type: 'CARD_PLAYED', actorId: 'A', cardInstanceId: attack, use: 'attack', targetIds: ['B']});
  const passed = indexOf(logs, {type: 'PASSED', windowKind: 'declaration'}, played);
  const defended = indexOf(logs, {type: 'CARD_PLAYED', actorId: 'B', cardInstanceId: defense, use: 'defense', targetIds: ['A']});
  const ended = indexOf(logs, {type: 'TURN_ENDED', actorId: 'A', turnNumber: 1});
  expect([started, played, passed, defended, ended].every(index => index >= 0)).toBe(true);
  expect(started).toBeLessThan(played); expect(played).toBeLessThan(passed); expect(passed).toBeLessThan(defended); expect(defended).toBeLessThan(ended);
  expect(indexOf(logs, {type: 'PASSED', actorId: 'A', windowKind: 'withdrawal'})).toBeGreaterThan(defended);
  expect(indexOf(logs, {type: 'TURN_STARTED', actorId: 'B', turnNumber: 2})).toBe(-1);
});

it('a chant stays unnamed until the attack turns it face up, and every hit adds up in one damage record', () => {
  let s = ready(); character(s, 'A', '侍大将のシン');
  const card = handCard(s, 'A', '天地百撃斬');
  s = act(s, 'A', {type: 'CHANT', cardInstanceId: card, dedicated: true});
  for (const viewer of ['B', 'C', 'D']) expect(JSON.stringify(viewFor(s, viewer).logs)).not.toContain(card);
  s = turnOf(s, 'A');
  for (const viewer of ['B', 'C', 'D']) expect(JSON.stringify(viewFor(s, viewer).logs)).not.toContain(card);
  s = act(s, 'A', {type: 'START_TURN'}); s = finish(s); s = act(s, 'A', {type: 'CHOOSE_DRAW', draw: false});
  s = act(s, 'A', {type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'C'], dedicated: true});
  s = until(s, 'damage'); s = closeWindow(s, [3]); s = closeWindow(s); s = finish(s);
  expect(s.players.B!.damage).toBe(21); expect(s.players.C!.damage).toBe(21);
  const logs = record(s, 'D');
  expect(logs.filter(log => log.cardInstanceId === card)).toEqual([expect.objectContaining({type: 'CARD_PLAYED', actorId: 'A', use: 'attack', targetIds: ['B', 'C']})]);
  expect(indexOf(logs, {type: 'CARD_PLAYED', cardInstanceId: card})).toBeGreaterThan(indexOf(logs, {type: 'TURN_STARTED', actorId: 'A', turnNumber: 5}));
  expect(logs.filter(log => log.type === 'DAMAGE_APPLIED')).toEqual([
    expect.objectContaining({actorId: 'B', amount: 21}), expect.objectContaining({actorId: 'C', amount: 21}),
  ]);
});

it('S01 rerolls keep one roll identity with numbered attempts, and fate marks the forced failure', () => {
  const players = ['A', 'B', 'C', 'D'].map(id => ({id, name: id}));
  const passUntil = (s: GameState, done: (s: GameState) => boolean) => { for (let n = 0; n < 300 && !done(s); n++) s = pass(s, [4, 4]); return s; };
  let s = makeR6RollScenario(players);
  const id = s.rolls!.at(-1)!.id, since = s.nextEventId;
  s = act(s, 'B', {type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r1c3', mode: 'reroll', targetRollId: id});
  s = passUntil(s, s => s.rolls!.at(-1)!.attempts.length === 2);
  const rolls = record(s).filter(log => log.id >= since && log.type === 'ROLL_RESOLVED' && log.roll?.rollId === id);
  expect(rolls.map(log => [log.roll!.attempt, log.roll!.faces])).toEqual([[2, [4, 4]]]);
  expect(indexOf(record(s), {type: 'CARD_PLAYED', actorId: 'B', cardInstanceId: 'a2-p02-r1c3', use: 'anytime'})).toBeGreaterThanOrEqual(0);

  let fate = makeR6RollScenario(players, true);
  const fateId = fate.rolls!.at(-1)!.id;
  fate = act(fate, 'C', {type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'force-fail', targetRollId: fateId});
  fate = passUntil(fate, s => s.rolls!.at(-1)!.forcedFailure);
  const forced = record(fate, 'A').filter(log => log.type === 'ROLL_RESOLVED' && log.roll?.rollId === fateId).at(-1)!;
  expect(forced.roll).toMatchObject({attempt: 1, faces: [2, 3], forcedFailure: true});
  if (fate.players[forced.actorId]!.revealed) expect(forced.roll!.success).toBe(false);
});

it('records a stop with its resistance roll and damage, then its recovery on the stopped turn', () => {
  let s = ready(); character(s, 'A', '大神官ジル');
  const card = handCard(s, 'A', '狂王陣');
  s = act(s, 'A', {type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false});
  s = until(s, 'hit'); s = closeWindow(s);
  while (s.windows?.at(-1)?.kind === 'hit-abilities') s = closeWindow(s);
  s = closeWindow(s, [6, 6]); s = finish(closeWindow(s));
  expect(s.players.B!.statuses?.map(status => status.kind)).toEqual(['stopped']);
  let logs = record(s);
  const resisted = indexOf(logs, {type: 'ROLL_RESOLVED', actorId: 'B'});
  expect(logs[resisted]!.roll).toMatchObject({kind: 'status-resistance', faces: [6, 6], attempt: 1});
  expect(indexOf(logs, {type: 'DAMAGE_APPLIED', actorId: 'B', amount: 5})).toBeGreaterThan(resisted);
  expect(indexOf(logs, {type: 'STATUS_CHANGED', actorId: 'B', status: {kind: 'stopped', change: 'applied'}})).toBeGreaterThan(resisted);
  s = turnOf(s, 'B');
  s = act(s, 'B', {type: 'START_TURN'}, [1, 1]);
  for (let n = 0; n < 20 && s.windows?.length; n++) s = pass(s, [1, 1]);
  expect(s.players.B!.statuses ?? []).toEqual([]);
  logs = record(s);
  expect(indexOf(logs, {type: 'STATUS_CHANGED', actorId: 'B', status: {kind: 'stopped', change: 'removed'}})).toBeGreaterThan(indexOf(logs, {type: 'TURN_STARTED', actorId: 'B'}));
});

it('approach and withdrawal record the distance cards and the resulting near and far pair', () => {
  let s = ready();
  const [first, second] = handCards(s, ['A', 'A'], '踏み込み／殴る'), maai = handCard(s, 'B', '間合い／休息');
  s = act(s, 'A', {type: 'APPROACH', targetId: 'B', cardInstanceId: first});
  s = passReclaims(act(s, 'B', {type: 'PLAY_MAAI', cardInstanceId: maai}));
  s = passReclaims(act(s, 'A', {type: 'PLAY_ADVANCE', cardInstanceId: second}));
  s = finish(act(s, 'B', {type: 'PASS'}));
  let logs = record(s);
  const cards = logs.filter(log => log.type === 'CARD_PLAYED').map(log => [log.actorId, log.cardInstanceId, log.use, log.targetIds]);
  expect(cards).toEqual([['A', first, 'advance', ['B']], ['B', maai, 'maai', ['A']], ['A', second, 'advance', ['B']]]);
  expect(logs.filter(log => log.type === 'DISTANCE_CHANGED')).toEqual([expect.objectContaining({actorId: 'A', targetId: 'B', distance: 'near'})]);
  s.phase = 'withdrawal';
  const retreat = handCard(s, 'A', '間合い／休息');
  s = finish(act(act(s, 'A', {type: 'WITHDRAW', targetId: 'B', cardInstanceId: retreat}), 'B', {type: 'PASS'}));
  logs = record(s);
  expect(logs.filter(log => log.type === 'DISTANCE_CHANGED').map(log => log.distance)).toEqual(['near', 'far']);
});

it('projects each record type through a fixed field allowlist and hides a concealed actor', () => {
  const s = ready();
  const secret = {cardInstanceId: 'a2-p01-r1c1', characterId: 'c2-p01-r1c1', targetId: 'D', count: 9, amount: 9, abilityId: 'secret-ability', windowKind: 'secret', turnNumber: 99, targetIds: ['D'], use: 'attack' as const, distance: 'near' as const, status: {kind: 'stopped' as const, change: 'applied' as const}};
  const roll = {rollId: 'roll-1', kind: 'ability-check' as const, faces: [3, 4], total: 7, threshold: 8, success: true, attempt: 1};
  const events: Omit<GameEvent, 'id' | 'at' | 'audience'>[] = [
    {type: 'TURN_STARTED', actorId: 'A', ...secret},
    {type: 'TURN_ENDED', actorId: 'A', ...secret},
    {type: 'REST', actorId: 'A', ...secret},
    {type: 'CARD_PLAYED', actorId: 'A', ...secret, roll},
    {type: 'ABILITY_DECLARED', actorId: 'B', ...secret, concealed: true},
    {type: 'ABILITY_CANCELED', actorId: 'A', ...secret},
    {type: 'ROLL_RESOLVED', actorId: 'B', ...secret, roll, concealed: true},
    {type: 'DAMAGE_APPLIED', actorId: 'A', ...secret},
    {type: 'STATUS_CHANGED', actorId: 'A', ...secret},
    {type: 'DISTANCE_CHANGED', actorId: 'A', ...secret},
    {type: 'PASSED', actorId: 'A', ...secret},
  ];
  s.events = events.map((event, index) => ({...event, id: 1000 + index, at: 1, audience: 'public'}));
  const keys = (viewer: string) => viewFor(s, viewer).logs.map(log => [log.type, Object.keys(log).filter(key => !['id', 'at', 'type', 'actorId'].includes(key)).sort()]);
  expect(keys('C')).toEqual([
    ['TURN_STARTED', ['turnNumber']],
    ['TURN_ENDED', ['turnNumber']],
    ['REST', ['count']],
    ['CARD_PLAYED', ['cardInstanceId', 'targetIds', 'use']],
    ['ABILITY_DECLARED', []],
    ['ABILITY_CANCELED', ['abilityId', 'targetIds']],
    ['ROLL_RESOLVED', ['roll']],
    ['DAMAGE_APPLIED', ['amount']],
    ['STATUS_CHANGED', ['status']],
    ['DISTANCE_CHANGED', ['distance', 'targetId']],
    ['PASSED', ['windowKind']],
  ]);
  const hiddenRoll = viewFor(s, 'C').logs.find(log => log.type === 'ROLL_RESOLVED')!.roll!;
  expect(hiddenRoll).toEqual({rollId: 'roll-1', kind: 'ability-check', faces: [3, 4], total: 7, attempt: 1});
  const own = viewFor(s, 'B').logs;
  expect(own.find(log => log.type === 'ABILITY_DECLARED')).toMatchObject({abilityId: 'secret-ability', targetIds: ['D']});
  expect(own.find(log => log.type === 'ROLL_RESOLVED')!.roll).toMatchObject({threshold: 8, success: true});
});
