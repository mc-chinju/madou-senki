import {actionCards, getAction} from '@madou/catalog';
import {expect, it} from 'vitest';
import {gameStats, viewFor, type GameEvent, type GameState, type LogView} from '../src/index.js';
import {act, closeWindow, finish, pass, passReclaims, ready, until} from './combat-helpers.js';
import {recordCardPlayed} from '../src/public-record.js';
import {character, handCard, handCards} from './fixtures.js';
import {makeR6RollScenario} from './fixtures/r6-roll-scenarios.js';

const RECORD_TYPES = new Set(['TURN_STARTED', 'TURN_ENDED', 'REST', 'CARD_PLAYED', 'ATTACK_DECLARED', 'ATTACK_RESOLVED', 'CHECK_SKIPPED', 'ABILITY_DECLARED', 'ABILITY_CANCELED', 'ROLL_RESOLVED', 'DAMAGE_APPLIED', 'STATUS_CHANGED', 'DISTANCE_CHANGED', 'PASSED']);
const record = (s: GameState, viewer = 'C') => viewFor(s, viewer).logs.filter(log => RECORD_TYPES.has(log.type));
const indexOf = (logs: LogView[], match: Partial<LogView>, from = 0) => logs.findIndex((log, index) => index >= from && Object.entries(match).every(([key, value]) => JSON.stringify(log[key as keyof LogView]) === JSON.stringify(value)));

it('keeps the previous state and its historical payloads independent after a move', () => {
  const before = ready();
  before.events.push({id: before.nextEventId++, at: 1, type: 'ROLL_RESOLVED', actorId: 'A',
    audience: {playerId: 'A'}, targetIds: ['B'], death: {cause: 'attack', eventId: 'old'},
    roll: {rollId: 'old-roll', kind: 'ability-check', faces: [2, 3], total: 5, attempt: 1},
    status: {kind: 'stopped', change: 'applied'}});
  const original = structuredClone(before);
  const next = act(before, 'A', {type: 'PASS_ACTION'});
  expect(next.events.slice(0, before.events.length)).toEqual(before.events);
  const historical = next.events[before.events.length - 1]!;
  historical.targetIds!.push('C');
  historical.death!.eventId = 'changed';
  historical.roll!.faces[0] = 6;
  historical.roll!.total = 9;
  historical.status!.change = 'removed';
  if (historical.audience !== 'public') historical.audience.playerId = 'B';
  expect(before).toEqual(original);
});

it.each([true, false])('records a selected declaration ability when its window opens (revealed=%s)', revealed => {
  let s = ready();
  character(s, 'A', '白魔術師シェリム');
  s.players.A!.revealed = revealed;
  const card = handCard(s, 'A', '烈火'), abilityId = 'c2-p01-r1c1-ab03';
  s = act(s, 'A', {type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false, declarationAbilityIds: [abilityId]});
  expect(record(s, 'A').filter(log => log.type === 'ABILITY_DECLARED')).toEqual([]);
  s = closeWindow(s);
  expect(record(s, 'A').filter(log => log.type === 'ABILITY_DECLARED')).toEqual([
    expect.objectContaining({actorId: 'A', abilityId, targetIds: ['B']}),
  ]);
  const others = record(s, 'B').filter(log => log.type === 'ABILITY_DECLARED');
  expect(others).toHaveLength(1);
  if (revealed) expect(others[0]).toMatchObject({actorId: 'A', abilityId, targetIds: ['B']});
  else {
    expect(others[0]).not.toHaveProperty('abilityId');
    expect(others[0]).not.toHaveProperty('targetIds');
  }
});

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
  // The declaration and the ending both name the card, which is how a reader pairs them.
  expect(logs.filter(log => log.cardInstanceId === card)).toEqual([
    expect.objectContaining({type: 'CARD_PLAYED', actorId: 'A', use: 'attack', targetIds: ['B', 'C']}),
    expect.objectContaining({type: 'ATTACK_RESOLVED', actorId: 'A', attackOutcome: 'hit', targetIds: ['B', 'C']}),
  ]);
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
  const roll = {rollId: 'roll-1', kind: 'ability-check' as const, faces: [3, 4], total: 7, threshold: 8, comparison: 'greater-than' as const, success: true, attempt: 1};
  const events: Omit<GameEvent, 'id' | 'at' | 'audience'>[] = [
    {type: 'TURN_STARTED', actorId: 'A', ...secret},
    {type: 'TURN_ENDED', actorId: 'A', ...secret},
    {type: 'REST', actorId: 'A', ...secret},
    {type: 'CARD_PLAYED', actorId: 'A', ...secret, roll},
    {type: 'ATTACK_DECLARED', actorId: 'B', ...secret, concealed: true},
    {type: 'ATTACK_RESOLVED', actorId: 'B', ...secret, attackOutcome: 'hit', concealed: true},
    {type: 'CHECK_SKIPPED', actorId: 'B', ...secret, checkSkip: 'ability', concealed: true},
    {type: 'CHECK_SKIPPED', actorId: 'A', ...secret, checkSkip: 'level'},
    {type: 'ABILITY_DECLARED', actorId: 'B', ...secret, concealed: true},
    {type: 'ABILITY_CANCELED', actorId: 'A', ...secret},
    {type: 'ROLL_RESOLVED', actorId: 'B', ...secret, roll, concealed: true},
    {type: 'DAMAGE_APPLIED', actorId: 'A', ...secret},
    {type: 'STATUS_CHANGED', actorId: 'A', ...secret},
    {type: 'DISTANCE_CHANGED', actorId: 'A', ...secret},
    {type: 'PASSED', actorId: 'A', ...secret},
    {type: 'CARDS_DISCARDED', actorId: 'A', ...secret},
    {type: 'CHANTED', actorId: 'A', ...secret},
    {type: 'FOLLOWERS_ARRANGED', actorId: 'A', ...secret},
    {type: 'FOLLOWER_DEFENDED', actorId: 'B', ...secret, followerOutcome: 'blocked'},
    {type: 'MORALE_CHECKED', actorId: 'B', ...secret, success: true},
    {type: 'CARD_RECLAIMED', actorId: 'A', ...secret},
    {type: 'DECK_RESHUFFLED', actorId: 'A', ...secret},
  ];
  s.events = events.map((event, index) => ({...event, id: 1000 + index, at: 1, audience: 'public'}));
  const keys = (viewer: string) => viewFor(s, viewer).logs.map(log => [log.type, Object.keys(log).filter(key => !['id', 'at', 'type', 'actorId'].includes(key)).sort()]);
  expect(keys('C')).toEqual([
    ['TURN_STARTED', ['turnNumber']],
    ['TURN_ENDED', ['turnNumber']],
    ['REST', ['count']],
    ['CARD_PLAYED', ['cardInstanceId', 'targetIds', 'use']],
    // A card-less attack keeps its targets public; only the ability name follows the concealed seat.
    ['ATTACK_DECLARED', ['targetIds']],
    // How an attack ended is seen at the table, and it names the card its declaration already named;
    // only a card-less attack's ability follows the concealed seat.
    ['ATTACK_RESOLVED', ['attackOutcome', 'cardInstanceId', 'targetIds']],
    ['CHECK_SKIPPED', ['checkSkip']],
    ['CHECK_SKIPPED', ['abilityId', 'checkSkip']],
    ['ABILITY_DECLARED', []],
    ['ABILITY_CANCELED', ['abilityId', 'targetIds']],
    ['ROLL_RESOLVED', ['roll']],
    ['DAMAGE_APPLIED', ['amount']],
    ['STATUS_CHANGED', ['status']],
    ['DISTANCE_CHANGED', ['distance', 'targetId']],
    ['PASSED', ['windowKind']],
    // A face-down discard is a number to the table; the name rides only on the owner's private copy.
    ['CARDS_DISCARDED', ['count']],
    // A chant goes down face down, so the line is the seat and nothing else.
    ['CHANTED', []],
    ['FOLLOWERS_ARRANGED', ['count']],
    // A follower that answers an attack is face up by then, so the engine may put its name on the line.
    ['FOLLOWER_DEFENDED', ['cardInstanceId', 'followerOutcome']],
    ['MORALE_CHECKED', ['cardInstanceId', 'success']],
    ['CARD_RECLAIMED', ['cardInstanceId']],
    ['DECK_RESHUFFLED', ['count']],
  ]);
  // Only the owner's own line spells out a card the table never saw go.
  const hidden = viewFor(s, 'C').logs.find(log => log.type === 'CARDS_DISCARDED')!;
  expect(hidden).not.toHaveProperty('cardInstanceId');
  // G03 判定の公開範囲: the outcome reaches everyone, the threshold only a revealed seat.
  const hiddenRoll = viewFor(s, 'C').logs.find(log => log.type === 'ROLL_RESOLVED')!.roll!;
  expect(hiddenRoll).toEqual({rollId: 'roll-1', kind: 'ability-check', faces: [3, 4], total: 7, attempt: 1, success: true});
  const own = viewFor(s, 'B').logs;
  expect(own.find(log => log.type === 'ABILITY_DECLARED')).toMatchObject({abilityId: 'secret-ability', targetIds: ['D']});
  expect(own.find(log => log.type === 'ATTACK_DECLARED')).toMatchObject({abilityId: 'secret-ability', targetIds: ['D']});
  expect(own.find(log => log.type === 'CHECK_SKIPPED')).toMatchObject({abilityId: 'secret-ability', checkSkip: 'ability'});
  // The direction the threshold is read travels with it, so it stays behind the same gate.
  expect(own.find(log => log.type === 'ROLL_RESOLVED')!.roll).toMatchObject({threshold: 8, comparison: 'greater-than', success: true});
});


it.each([true, false])('records resolved conditional and sad-love deactivation (revealed=%s)', revealed => {
  for (const sadLove of [false, true]) {
    let s = ready();
    character(s, 'A', sadLove ? '獣使いのウパニシャット' : '有翼人のティア');
    s.players.A!.revealed = revealed;
    const abilityId = sadLove ? 'c2-p05-r1c2-ab05' : 'c2-p02-r1c1-ab04';
    const toggle = (enabled: boolean) => {
      const v = viewFor(s, 'A');
      const targetEventId = sadLove ? v.sadLove!.targetEventId! : v.conditionalAbilities.find(o => o.abilityId === abilityId)!.targetEventId!;
      return act(s, 'A', sadLove
        ? {type: 'USE_ABILITY', abilityId, mode: 'aura', enabled, targetEventId}
        : {type: 'SET_CONDITIONAL_ABILITY', abilityId: abilityId as 'c2-p02-r1c1-ab04', enabled, targetEventId});
    };
    s = finish(toggle(true));
    const since = s.nextEventId;
    s = toggle(false);
    const own = record(s, 'A').filter(log => log.id >= since && log.type === 'ABILITY_CANCELED');
    expect(own).toEqual([expect.objectContaining({actorId: 'A', abilityId})]);
    const other = record(s, 'C').filter(log => log.id >= since && log.type === 'ABILITY_CANCELED');
    expect(other).toHaveLength(1);
    if (revealed) expect(other[0]).toMatchObject({abilityId});
    else expect(other[0]).not.toHaveProperty('abilityId');
  }
});

it('records the public target of revelation in the third-party history', () => {
  let s = ready();
  const cardInstanceId = handCard(s, 'A', getAction('a2-p02-r1c2')!.name);
  const option = viewFor(s, 'A').anytimeCardOptions.find(o => o.cardInstanceId === cardInstanceId && o.targetId === 'B')!;
  s = act(s, 'A', {type: 'PLAY_ANYTIME_CARD', cardInstanceId, targetEventId: option.targetEventId, targetId: 'B'});
  expect(record(s, 'C').filter(log => log.cardInstanceId === cardInstanceId)).toEqual([
    expect.objectContaining({type: 'CARD_PLAYED', actorId: 'A', use: 'anytime', targetIds: ['B']}),
  ]);
});

it.each([true, false])('records why a usage check never happened, naming the ability only for a revealed seat (revealed=%s)', revealed => {
  let s = ready();
  character(s, 'A', '餓狼ヨーツルム');
  s.players.A!.revealed = revealed;
  s.distances.A!.B = 'near'; s.distances.B!.A = 'near';
  const card = handCard(s, 'A', '狼牙');
  s = act(s, 'A', {type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false, declarationAbilityIds: ['c2-p06-r2c2-ab02']});
  s = until(s, 'effect-level');
  const own = record(s, 'A').filter(log => log.type === 'CHECK_SKIPPED');
  expect(own).toEqual([expect.objectContaining({actorId: 'A', checkSkip: 'ability', abilityId: 'c2-p06-r2c2-ab02'})]);
  const other = record(s, 'C').filter(log => log.type === 'CHECK_SKIPPED');
  expect(other).toHaveLength(1);
  expect(other[0]!.checkSkip).toBe('ability');
  if (revealed) expect(other[0]).toMatchObject({abilityId: 'c2-p06-r2c2-ab02'});
  else expect(other[0]).not.toHaveProperty('abilityId');
});

it('records an attack whose level needed no check at all', () => {
  let s = ready();
  const attack = handCard(s, 'A', '踏み込み／弓');
  s = act(s, 'A', {type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false});
  s = until(s, 'normal-defense');
  expect(record(s, 'C').filter(log => log.type === 'CHECK_SKIPPED')).toEqual([
    expect.objectContaining({actorId: 'A', checkSkip: 'level'}),
  ]);
});

/** A declared attack has to say how it ended, or the reader ties the next damage line to the wrong attack. */
it('closes a landed attack with its outcome, once, next to the damage it caused', () => {
  let s = ready();
  const attack = handCard(s, 'A', '踏み込み／弓');
  s = finish(act(s, 'A', {type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false}));
  const logs = record(s, 'C');
  const outcomes = logs.filter(log => log.type === 'ATTACK_RESOLVED');
  expect(outcomes).toEqual([expect.objectContaining({actorId: 'A', attackOutcome: 'hit', targetIds: ['B']})]);
  // The ending sits after the damage it explains, not nineteen lines later under someone else's attack.
  expect(indexOf(logs, {type: 'ATTACK_RESOLVED'})).toBeGreaterThan(indexOf(logs, {type: 'DAMAGE_APPLIED'}));
});

it('closes an attack that never landed, so a failed check is not left dangling', () => {
  let s = ready();
  // A high 使用Lv forces excess-level checks; every window is closed on sixes so the check fails.
  const attack = handCard(s, 'A', '白輪');
  const sixes = Array(30).fill(6);
  s = act(s, 'A', {type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false}, sixes);
  for (let n = 0; n < 300 && s.windows?.length; n++) s = pass(s, sixes);
  const outcomes = record(s, 'C').filter(log => log.type === 'ATTACK_RESOLVED');
  expect(outcomes).toEqual([expect.objectContaining({actorId: 'A', attackOutcome: 'fizzled', targetIds: ['B']})]);
  // Nothing landed, so the record must not carry a damage line the reader could tie to it.
  expect(record(s, 'C').filter(log => log.type === 'DAMAGE_APPLIED')).toEqual([]);
});

const ALL_ARMY = 'a2-p05-r2c2';
const uses = (s: GameState, viewer = 'C') => record(s, viewer).filter(log => log.type === 'CARD_PLAYED').map(log => [log.cardInstanceId, log.use]);
const outcomes = (s: GameState, viewer = 'C') => record(s, viewer).filter(log => log.type === 'ATTACK_RESOLVED')
  .map(log => [log.attackOutcome, log.cardInstanceId ?? log.abilityId, (log.targetIds ?? []).join(',')]);

/** 全軍突撃せよ pays two cards for one charge; both of its endings used to be missing. */
function charge(follower = 'a2-p20-r3c1') {
  const s = ready();
  for (const p of Object.values(s.players)) p.permanent = {endurance: 100};
  handCard(s, 'A', getAction(ALL_ARMY)!.name); handCard(s, 'A', getAction(follower)!.name);
  return {s, command: {type: 'PLAY_ALL_ARMY' as const, cardInstanceId: ALL_ARMY, followerCardInstanceId: follower, targetIds: ['B']}};
}

it('closes a charge whose morale failed, and one cancelled before it started', () => {
  let {s, command} = charge();
  s.players.A!.permanent = {endurance: 100, spirit: -20};
  s = closeWindow(closeWindow(act(s, 'A', command)));
  s = finish(closeWindow(s, [1, 1]));
  expect(s.players.B!.damage).toBe(0);
  expect(outcomes(s)).toEqual([['fizzled', command.followerCardInstanceId, 'B']]);
  // 全軍突撃せよ is printed 複合 like the other two; the follower under it is what declares the attack.
  expect(uses(s)).toEqual([[ALL_ARMY, 'combination'], [command.followerCardInstanceId, 'attack']]);

  let cancelled = charge();
  const fate = handCard(cancelled.s, 'B', '命運凶変');
  let t = pass(act(cancelled.s, 'A', cancelled.command));
  t = act(t, 'B', {type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel', targetActionId: viewFor(t, 'B').reactionTargetActionId!});
  t = finish(t);
  expect(t.players.B!.damage).toBe(0);
  expect(outcomes(t)).toEqual([['nullified', cancelled.command.followerCardInstanceId, 'B']]);
});

/** A bundle declares several followers at once, so each declaration needs its own ending to pair with. */
function bundle(s: GameState, fairy: string, soldier: string) {
  return act(s, 'A', {type: 'USE_FOLLOWER_ATTACK', abilityId: 'c2-p06-r1c2-ab04', targetEventId: `turn-${s.turnNumber ?? 0}-A-action`,
    sources: [{cardInstanceId: fairy, dedicated: false, targetIds: ['B']}, {cardInstanceId: soldier, dedicated: false, targetIds: ['B']}]});
}
function bundleTable() {
  const s = ready(); character(s, 'A', '魔聖母ディア'); s.distances.A!.B = s.distances.B!.A = 'near';
  return {s, fairy: handCard(s, 'A', '妖精族'), soldier: handCard(s, 'A', '兵士')};
}

it('gives every follower in a bundle its own ending, named, whether it lands or the bundle is thrown away', () => {
  const landed = bundleTable();
  const hit = finish(bundle(landed.s, landed.fairy, landed.soldier));
  expect(outcomes(hit)).toEqual([['hit', landed.fairy, 'B'], ['hit', landed.soldier, 'B']]);

  const stopped = bundleTable();
  const fate = handCard(stopped.s, 'B', '命運凶変');
  let t = pass(bundle(stopped.s, stopped.fairy, stopped.soldier));
  t = act(t, 'B', {type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel-ability', targetAbilityId: viewFor(t, 'B').reactionTargetAbilityId!});
  t = finish(t);
  expect(t.players.B!.damage).toBe(0);
  expect(outcomes(t)).toEqual([['nullified', stopped.fairy, 'B'], ['nullified', stopped.soldier, 'B']]);
});

it('says an attack landed on the seat that took the hit in the target\'s place', () => {
  let s = ready(); character(s, 'C', '黒騎士ガーウィン'); handCard(s, 'C', '身代わり');
  const card = handCard(s, 'A', '踏み込み／弓');
  s = act(s, 'A', {type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false});
  s = pass(pass(until(s, 'attack-abilities')));
  const option = viewFor(s, 'C').anytimeCardOptions.find(o => o.cardInstanceId === 'a2-p02-r2c1')!;
  s = finish(act(s, 'C', {type: 'PLAY_ANYTIME_CARD', cardInstanceId: 'a2-p02-r2c1', targetEventId: option.targetEventId,
    targetId: option.targetId, groupId: option.groupId, hitIndex: option.hitIndex}));
  expect([s.players.B!.damage, s.players.C!.damage]).toEqual([0, 4]);
  // It landed, on C; calling it blocked against B contradicted the damage line right above it.
  expect(outcomes(s, 'D')).toEqual([['hit', card, 'C']]);
});

/** 呪払 is printed as 攻撃の前 and never makes an attack frame, so it must not read as an attack declaration. */
it('keeps cards that declare no attack out of the attack wording', () => {
  let s = ready(); character(s, 'B', '黒騎士ガーウィン');
  const golem = handCard(s, 'B', 'ウッドゴーレム');
  s.players.B!.hand = s.players.B!.hand.filter(id => id !== golem);
  s.players.B!.followers = [{cardInstanceId: golem, revealed: false}];
  handCard(s, 'A', '呪払');
  const card = handCard(s, 'A', '踏み込み／弓');
  s = finish(act(s, 'A', {type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false, dispel: {cardInstanceId: 'a2-p02-r3c1', targetId: 'B'}}));
  const played = record(s, 'C').filter(log => log.type === 'CARD_PLAYED').map(log => [log.cardInstanceId, log.use]);
  expect(played).toContainEqual(['a2-p02-r3c1', 'anytime']);
  // One declaration, one ending: the pre-attack card is not a second attack.
  expect(played.filter(([, use]) => use === 'attack')).toEqual([[card, 'attack']]);
  expect(outcomes(s)).toHaveLength(1);
});

/** The word is chosen from the printed category, so a fifth 複合 card cannot come out reading differently. */
it('gives every card printed 複合 the same word, whatever a caller asks for', () => {
  const printed = actionCards.filter(card => {
    const category = (card as {printed_category?: string | string[]}).printed_category;
    return Array.isArray(category) ? category.includes('複合') : category === '複合';
  }).map(card => card.id);
  expect(printed).toEqual(['a2-p05-r1c3', 'a2-p05-r2c1', 'a2-p05-r2c2', 'a2-p05-r2c3']);
  const s = ready();
  for (const id of printed) recordCardPlayed(s, 'A', id, 'attack');
  expect(record(s, 'C').filter(log => log.type === 'CARD_PLAYED').map(log => [log.cardInstanceId, log.use]))
    .toEqual(printed.map(id => [id, 'combination']));
});

/** 必勝の祈り is 複合 too, on its own turn and when リーア姫 spends it on someone else's technique. */
it('says 必勝の祈り was used as a combination, whoever it is spent for', () => {
  const play = (owner: 'A' | 'C') => {
    let s = ready();
    if (owner === 'C') character(s, 'C', 'リーア姫');
    const card = handCard(s, 'A', '踏み込み／弓'), prayer = handCard(s, owner, '必勝の祈り');
    s = until(act(s, 'A', {type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false}), 'effect-level');
    const main = Object.values(s.actions!).find(a => a.kind === 'attack')!;
    for (let n = 0; n < 10 && s.windows?.at(-1)?.participants[s.windows.at(-1)!.cursor] !== owner; n++) s = pass(s);
    s = act(s, owner, {type: 'PLAY_REACTION', cardInstanceId: prayer, mode: 'effect-plus', targetActionId: main.id, ...(owner === 'C' ? {dedicated: true} : {})});
    return {s: finish(s), card, prayer};
  };
  for (const owner of ['A', 'C'] as const) {
    const {s, card, prayer} = play(owner);
    expect(uses(s, 'D'), owner).toEqual([[card, 'attack'], [prayer, 'combination']]);
  }
});

/** Every card printed 複合 gets the same word, and none of them reads as a declaration of its own. */
it('says a combination card was used as one, never as the attack it was paid for', () => {
  const spirit = 'a2-p05-r1c3', harp = 'a2-p05-r2c1';
  const s0 = ready(); character(s0, 'A', '大神官ジル');
  for (const p of Object.values(s0.players)) p.permanent = {endurance: 100};
  for (const id of [spirit, harp]) handCard(s0, 'A', getAction(id)!.name);
  const card = handCard(s0, 'A', '魔詩');
  const s = finish(act(s0, 'A', {type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false, combinationCardInstanceIds: [spirit, harp]}));
  expect(uses(s)).toEqual([[card, 'attack'], [spirit, 'combination'], [harp, 'combination']]);
  // One declaration and one ending: a component is not a second attack.
  expect(outcomes(s)).toEqual([['hit', card, 'B']]);
});
