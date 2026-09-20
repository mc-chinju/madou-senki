import {expect, it} from 'vitest';
import {gameStats, moveToDiscard, viewFor, type GameState, type LogView} from '../src/index.js';
import {act, finish, ready, until} from './combat-helpers.js';
import {character, handCard} from './fixtures.js';

const ofType = (s: GameState, viewer: string, type: LogView['type']) => viewFor(s, viewer).logs.filter(log => log.type === type);
const ownOfType = (s: GameState, viewer: string, type: LogView['type']) => viewFor(s, viewer).privateLogs.filter(log => log.type === type);
/** Nothing in the shared record may spell out a card that never turned face up. */
function namesNothing(s: GameState, viewer: string, cardInstanceIds: string[]): void {
  const shared = JSON.stringify(viewFor(s, viewer).logs);
  for (const id of cardInstanceIds) expect(shared, `viewer=${viewer} card=${id}`).not.toContain(id);
}

it('counts the cards a hand adjustment let go for the table and names them for their owner', () => {
  let s = ready();
  s = act(s, 'A', {type: 'PASS_ACTION'});
  const extra = [handCard(s, 'A', '烈火'), handCard(s, 'A', '白輪')];
  const since = s.nextEventId;
  s = act(s, 'A', {type: 'END_TURN', discardIds: extra});
  const shared = ofType(s, 'C', 'CARDS_DISCARDED').filter(log => log.id >= since);
  expect(shared.map(log => [log.actorId, log.count])).toEqual([['A', 1], ['A', 1]]);
  expect(shared.every(log => !('cardInstanceId' in log))).toBe(true);
  namesNothing(s, 'C', extra);
  expect(ownOfType(s, 'A', 'CARDS_DISCARDED').filter(log => log.id >= since).map(log => log.cardInstanceId)).toEqual(extra);
});

it('sweeps a dead seat\'s unseen hand into the same counted record', () => {
  let s = ready();
  s.players.B!.damage = gameStats(s, 'B').endurance - 1;
  const attack = handCard(s, 'A', '踏み込み／弓');
  const hand = [...s.players.B!.hand];
  s = finish(act(s, 'A', {type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false}));
  expect(s.players.B!.presence).toBe('dead');
  expect(ofType(s, 'C', 'CARDS_DISCARDED').filter(log => log.actorId === 'B')).toHaveLength(hand.length);
  namesNothing(s, 'C', hand);
  expect(ownOfType(s, 'B', 'CARDS_DISCARDED').map(log => log.cardInstanceId).sort()).toEqual([...hand].sort());
});

it('records a chant and an arrangement without naming what went face down', () => {
  let s = ready();
  const chant = handCard(s, 'A', '天地百撃斬');
  s = act(s, 'A', {type: 'CHANT', cardInstanceId: chant, dedicated: true});
  expect(ofType(s, 'C', 'CHANTED')).toEqual([expect.objectContaining({actorId: 'A'})]);
  namesNothing(s, 'C', [chant]);

  let t = ready();
  const follower = handCard(t, 'A', '兵士');
  t = act(t, 'A', {type: 'ARRANGE_FOLLOWERS', cardInstanceIds: [follower]});
  expect(ofType(t, 'C', 'FOLLOWERS_ARRANGED')).toEqual([expect.objectContaining({actorId: 'A', count: 1})]);
  namesNothing(t, 'C', [follower]);
});

/** A follower is turned face up to answer an attack, so its check and what it did are both public and in order. */
it('names the follower in its morale check and then in what it did to the attack', () => {
  let s = ready();
  const attack = handCard(s, 'A', '踏み込み／弓');
  const follower = handCard(s, 'B', '妖精族');
  s.players.B!.hand = s.players.B!.hand.filter(id => id !== follower);
  s.players.B!.followers = [{cardInstanceId: follower, revealed: false}];
  s = until(act(s, 'A', {type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false}), 'normal-defense');
  s = finish(act(s, 'B', {type: 'START_FOLLOWERS'}));
  const logs = viewFor(s, 'C').logs;
  const morale = logs.findIndex(log => log.type === 'MORALE_CHECKED');
  const defended = logs.findIndex(log => log.type === 'FOLLOWER_DEFENDED');
  expect(logs[morale]).toMatchObject({actorId: 'B', cardInstanceId: follower, success: true});
  expect(logs[defended]).toMatchObject({actorId: 'B', cardInstanceId: follower});
  expect(logs[defended]!.followerOutcome).toBeDefined();
  expect(morale).toBeLessThan(defended);
});

it('names a card taken back off the table, to everyone', () => {
  let s = ready();
  character(s, 'A', '大神官ジル');
  s.players.A!.damage = 1;
  const card = handCard(s, 'A', '封傷');
  s = until(act(s, 'A', {type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: card, targetIds: ['A'], dedicated: false}), 'reclaim');
  const reclaim = viewFor(s, 'A').reclaim!;
  s = act(s, 'A', {type: 'CHOOSE_RECLAIM', decisionId: reclaim.decisionId, claimId: reclaim.claims[0]!.claimId, choice: 'take'});
  expect(s.players.A!.hand.concat(s.reclaimReservations)).toContain(card);
  expect(ofType(s, 'C', 'CARD_RECLAIMED')).toEqual([expect.objectContaining({actorId: 'A', cardInstanceId: card})]);
});

it('records the pile going back under the deck, when it runs out and when Dawn calls it back', () => {
  const emptied = (dawn?: string) => {
    let s = ready();
    s = act(s, 'A', {type: 'PASS_ACTION'});
    // Only the pile is left to draw from, so the refill below has to rebuild the deck first.
    for (const id of [...s.deck]) moveToDiscard(s, id, {faceUp: true});
    s.deck = dawn ? [dawn] : [];
    if (dawn) s.discard = s.discard.filter(entry => entry.cardInstanceId !== dawn);
    moveToDiscard(s, s.players.A!.hand.pop()!, {faceUp: true});
    const pile = s.discard.length;
    return {s: act(s, 'A', {type: 'END_TURN', discardIds: []}), pile};
  };

  const {s: drained, pile} = emptied();
  expect(ofType(drained, 'C', 'DECK_RESHUFFLED')).toEqual([expect.objectContaining({actorId: 'A', count: pile})]);

  const dawn = 'a2-p01-r1c2';
  const {s: called} = emptied(dawn);
  expect(called.players.A!.open).toContain(dawn);
  expect(ofType(called, 'C', 'DECK_RESHUFFLED').map(log => log.actorId)).toContain('A');
  expect(called.discard).toEqual([]);
});
